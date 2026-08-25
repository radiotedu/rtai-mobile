import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import java.util.jar.JarOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

/**
 * Rebuilds KotlinAudio v2.1.0 so ExoPlayer prefers its bundled libFLAC decoder.
 *
 * KotlinAudio constructs ExoPlayer with the one-argument Builder constructor,
 * which disables extension renderers. Android's platform FLAC decoder rejects
 * RadioTEDU's continuous Ogg/FLAC stream on some devices. This deterministic
 * patch injects a DefaultRenderersFactory in PREFER mode while leaving the
 * remainder of the upstream Apache-2.0 AAR unchanged.
 */
public final class PatchKotlinAudio {
  private static final String TARGET_CLASS =
      "com/doublesymmetry/kotlinaudio/players/BaseAudioPlayer.class";
  private static final String BASE_AUDIO_PLAYER =
      "com/doublesymmetry/kotlinaudio/players/BaseAudioPlayer";
  private static final String EXO_BUILDER =
      "com/google/android/exoplayer2/ExoPlayer$Builder";
  private static final String RENDERERS_FACTORY =
      "com/google/android/exoplayer2/DefaultRenderersFactory";

  private PatchKotlinAudio() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 2) {
      throw new IllegalArgumentException("Usage: PatchKotlinAudio input.aar output.aar");
    }
    Path input = Path.of(args[0]);
    Path output = Path.of(args[1]);
    Files.createDirectories(output.toAbsolutePath().getParent());
    boolean[] patched = {false};

    try (ZipFile aar = new ZipFile(input.toFile());
         OutputStream fileOut = Files.newOutputStream(output);
         ZipOutputStream out = new ZipOutputStream(fileOut)) {
      Enumeration<? extends ZipEntry> entries = aar.entries();
      while (entries.hasMoreElements()) {
        ZipEntry sourceEntry = entries.nextElement();
        ZipEntry targetEntry = new ZipEntry(sourceEntry.getName());
        targetEntry.setTime(0L);
        out.putNextEntry(targetEntry);
        if (!sourceEntry.isDirectory()) {
          byte[] bytes;
          try (InputStream source = aar.getInputStream(sourceEntry)) {
            bytes = source.readAllBytes();
          }
          if ("classes.jar".equals(sourceEntry.getName())) {
            bytes = patchClassesJar(bytes, patched);
          }
          out.write(bytes);
        }
        out.closeEntry();
      }
    }

    if (!patched[0]) {
      Files.deleteIfExists(output);
      throw new IllegalStateException("KotlinAudio ExoPlayer builder call was not found");
    }
  }

  private static byte[] patchClassesJar(byte[] input, boolean[] patched) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    try (JarInputStream jar = new JarInputStream(new ByteArrayInputStream(input));
         JarOutputStream out = new JarOutputStream(buffer)) {
      JarEntry entry;
      while ((entry = jar.getNextJarEntry()) != null) {
        JarEntry target = new JarEntry(entry.getName());
        target.setTime(0L);
        out.putNextEntry(target);
        byte[] bytes = jar.readAllBytes();
        if (TARGET_CLASS.equals(entry.getName())) {
          bytes = patchBaseAudioPlayer(bytes, patched);
        }
        out.write(bytes);
        out.closeEntry();
      }
    }
    return buffer.toByteArray();
  }

  private static byte[] patchBaseAudioPlayer(byte[] input, boolean[] patched) {
    ClassReader reader = new ClassReader(input);
    ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
    ClassVisitor visitor = new ClassVisitor(Opcodes.ASM9, writer) {
      @Override
      public MethodVisitor visitMethod(
          int access, String name, String descriptor, String signature, String[] exceptions) {
        MethodVisitor delegate = super.visitMethod(access, name, descriptor, signature, exceptions);
        return new MethodVisitor(Opcodes.ASM9, delegate) {
          @Override
          public void visitMethodInsn(
              int opcode, String owner, String methodName, String methodDescriptor,
              boolean isInterface) {
            if (opcode == Opcodes.INVOKESPECIAL
                && EXO_BUILDER.equals(owner)
                && "<init>".equals(methodName)
                && "(Landroid/content/Context;)V".equals(methodDescriptor)) {
              // Existing stack: uninitialized ExoPlayer.Builder, Context.
              super.visitTypeInsn(Opcodes.NEW, RENDERERS_FACTORY);
              super.visitInsn(Opcodes.DUP);
              super.visitVarInsn(Opcodes.ALOAD, 0);
              super.visitFieldInsn(
                  Opcodes.GETFIELD,
                  BASE_AUDIO_PLAYER,
                  "context",
                  "Landroid/content/Context;");
              super.visitMethodInsn(
                  Opcodes.INVOKESPECIAL,
                  RENDERERS_FACTORY,
                  "<init>",
                  "(Landroid/content/Context;)V",
                  false);
              super.visitInsn(Opcodes.ICONST_2); // EXTENSION_RENDERER_MODE_PREFER
              super.visitMethodInsn(
                  Opcodes.INVOKEVIRTUAL,
                  RENDERERS_FACTORY,
                  "setExtensionRendererMode",
                  "(I)Lcom/google/android/exoplayer2/DefaultRenderersFactory;",
                  false);
              super.visitMethodInsn(
                  opcode,
                  owner,
                  methodName,
                  "(Landroid/content/Context;Lcom/google/android/exoplayer2/RenderersFactory;)V",
                  isInterface);
              patched[0] = true;
              return;
            }
            super.visitMethodInsn(opcode, owner, methodName, methodDescriptor, isInterface);
          }
        };
      }
    };
    reader.accept(visitor, 0);
    return writer.toByteArray();
  }
}
