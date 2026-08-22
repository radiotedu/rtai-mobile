from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import servicemanager
import win32api
import win32con
import win32event
import win32job
import win32service
import win32serviceutil


CONFIG_ROOT = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "RadioTEDU" / "ServicesCompanion" / "services"
LOG_ROOT = Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "RadioTEDU" / "ServicesCompanion" / "logs"


def _trace(service_name: str, message: str) -> None:
    try:
        LOG_ROOT.mkdir(parents=True, exist_ok=True)
        with (LOG_ROOT / f"{service_name}.host.log").open("a", encoding="utf-8") as stream:
            stream.write(f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} pid={os.getpid()} {message}\n")
    except OSError:
        pass


def _definition(service_name: str) -> tuple[str, str, Path, bool, dict[str, str]]:
    path = CONFIG_ROOT / f"{service_name}.services"
    command: tuple[str, str, Path, bool] | None = None
    child_env = dict(os.environ)
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("env|"):
            _kind, key, value = line.split("|", 2)
            child_env[key] = value
            continue
        fields = line.split("|")
        if len(fields) != 5:
            raise RuntimeError(f"invalid service definition for {service_name}")
        _label, executable, arguments, working_directory, restart = fields
        command = executable, arguments, Path(working_directory), restart.strip().lower() == "true"
    if command is None:
        raise RuntimeError(f"empty service definition for {service_name}")
    return *command, child_env


def _creation_flags(child_env: dict[str, str]) -> int:
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    priority = child_env.get("RADIOTEDU_PROCESS_PRIORITY", "").strip().lower()
    priority_flags = {
        "below_normal": getattr(subprocess, "BELOW_NORMAL_PRIORITY_CLASS", 0),
        "normal": getattr(subprocess, "NORMAL_PRIORITY_CLASS", 0),
        "above_normal": getattr(subprocess, "ABOVE_NORMAL_PRIORITY_CLASS", 0),
    }
    return flags | priority_flags.get(priority, 0)


class RadioTEDUService(win32serviceutil.ServiceFramework):
    _svc_name_ = "RadioTEDU.Base"
    _svc_display_name_ = "RadioTEDU Base"

    def __init__(self, args):
        super().__init__(args)
        # Manual-reset: every loop and teardown stage must observe shutdown.
        self.stop_event = win32event.CreateEvent(None, 1, 0, None)
        self.child: subprocess.Popen[bytes] | None = None
        self.job = None
        self.job_lock = threading.Lock()

    def SvcStop(self):
        _trace(self._svc_name_, "SvcStop entered")
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        self._terminate_job()
        _trace(self._svc_name_, "SvcStop returned")

    def _create_job(self, child: subprocess.Popen[bytes]) -> None:
        job = win32job.CreateJobObject(None, "")
        info = win32job.QueryInformationJobObject(
            job, win32job.JobObjectExtendedLimitInformation
        )
        info["BasicLimitInformation"]["LimitFlags"] |= (
            win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        )
        win32job.SetInformationJobObject(
            job, win32job.JobObjectExtendedLimitInformation, info
        )
        win32job.AssignProcessToJobObject(job, int(child._handle))
        with self.job_lock:
            self.job = job
        _trace(self._svc_name_, f"job assigned child={child.pid}")

    def _terminate_job(self) -> None:
        with self.job_lock:
            job = self.job
        if job is not None:
            try:
                win32job.TerminateJobObject(job, 1)
            except Exception:
                pass

    def _close_job(self) -> None:
        with self.job_lock:
            job, self.job = self.job, None
        if job is not None:
            try:
                win32api.CloseHandle(job)
            except Exception:
                pass

    def _stop_child(self):
        child = self.child
        if child is None or child.poll() is not None:
            return
        _trace(self._svc_name_, f"stopping child={child.pid}")
        self._terminate_job()
        if child.poll() is None:
            child.kill()
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.kill()
        _trace(self._svc_name_, f"child stopped={child.pid}")

    def SvcDoRun(self):
        LOG_ROOT.mkdir(parents=True, exist_ok=True)
        executable, arguments, working_directory, restart, child_env = _definition(self._svc_name_)
        command = f'"{executable}" {arguments}'
        out_path = LOG_ROOT / f"{self._svc_name_}.out.log"
        err_path = LOG_ROOT / f"{self._svc_name_}.err.log"
        servicemanager.LogInfoMsg(f"{self._svc_name_} host started")
        while True:
            if win32event.WaitForSingleObject(self.stop_event, 0) == win32event.WAIT_OBJECT_0:
                break
            with out_path.open("ab", buffering=0) as stdout, err_path.open("ab", buffering=0) as stderr:
                try:
                    self.child = subprocess.Popen(
                        command,
                        cwd=str(working_directory),
                        stdin=subprocess.DEVNULL,
                        stdout=stdout,
                        stderr=stderr,
                        env=child_env,
                        creationflags=_creation_flags(child_env),
                    )
                    try:
                        self._create_job(self.child)
                    except Exception as exc:
                        # Older/nested Windows job policies may reject assignment;
                        # direct child termination remains as a safe fallback.
                        self._close_job()
                        _trace(
                            self._svc_name_,
                            f"job assignment failed={type(exc).__name__}:{str(exc)[:120]}",
                        )
                    while self.child.poll() is None:
                        if win32event.WaitForSingleObject(self.stop_event, 1000) == win32event.WAIT_OBJECT_0:
                            _trace(self._svc_name_, "stop event observed")
                            self._stop_child()
                            break
                except Exception as exc:
                    servicemanager.LogErrorMsg(f"{self._svc_name_} child error: {type(exc).__name__}")
            self._close_job()
            self.child = None
            if not restart or win32event.WaitForSingleObject(self.stop_event, 5000) == win32event.WAIT_OBJECT_0:
                break
        servicemanager.LogInfoMsg(f"{self._svc_name_} host stopped")
        _trace(self._svc_name_, "SvcDoRun returned")


class JukeLocalService(RadioTEDUService):
    _svc_name_ = "RadioTEDU.JukeLocalMediaAgent"
    _svc_display_name_ = "RadioTEDU JukeLocal Media Agent"


class VotingService(RadioTEDUService):
    _svc_name_ = "RadioTEDUVotingRadio"
    _svc_display_name_ = "RadioTEDU Voting Radio"


class SharedAIService(RadioTEDUService):
    _svc_name_ = "RadioTEDU.SharedAI"
    _svc_display_name_ = "RadioTEDU Shared AI"


class AIStreamsService(RadioTEDUService):
    _svc_name_ = "RadioTEDU.AIStreams"
    _svc_display_name_ = "RadioTEDU AI Streams"


SERVICES = (JukeLocalService, VotingService, SharedAIService, AIStreamsService)


def _stop_existing(name: str) -> None:
    try:
        win32serviceutil.StopService(name)
    except Exception:
        pass
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        try:
            if win32serviceutil.QueryServiceStatus(name)[1] == win32service.SERVICE_STOPPED:
                return
        except Exception:
            return
        time.sleep(0.5)
    manager = win32service.OpenSCManager(None, None, win32service.SC_MANAGER_CONNECT)
    try:
        service = win32service.OpenService(manager, name, win32service.SERVICE_QUERY_STATUS)
        try:
            process_id = int(win32service.QueryServiceStatusEx(service).get("ProcessId") or 0)
        finally:
            win32service.CloseServiceHandle(service)
    finally:
        win32service.CloseServiceHandle(manager)
    if process_id:
        process = win32api.OpenProcess(win32con.PROCESS_TERMINATE, False, process_id)
        try:
            win32api.TerminateProcess(process, 1)
        finally:
            win32api.CloseHandle(process)
        time.sleep(1)


def install() -> None:
    for service_class in SERVICES:
        name = service_class._svc_name_
        _stop_existing(name)
        try:
            win32serviceutil.RemoveService(name)
            time.sleep(1)
        except Exception:
            pass
        class_string = win32serviceutil.GetServiceClassString(service_class)
        win32serviceutil.InstallService(
            class_string,
            name,
            service_class._svc_display_name_,
            startType=win32service.SERVICE_AUTO_START,
            description="RadioTEDU independently supervised companion service",
            delayedstart=False,
        )


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "install":
        install()
    else:
        win32serviceutil.HandleCommandLine(RadioTEDUService)
