import React, {useEffect, useRef, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {startCampusLocation} from '../services/campusLocationService';
import {COLORS, SPACING} from '../theme/theme';
import {useTranslation} from 'react-i18next';
import {CampusContext, CAMPUS_CONTEXTS, selectCampusContext} from '../services/campusSpatialService';

export default function CampusLocationControl() {
  const {t} = useTranslation();
  const [context, setContext] = useState<CampusContext>('grass');
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup.current?.(); }; }, []);
  return <View style={{padding: SPACING.md, borderRadius: 16, backgroundColor: '#191919', marginVertical: SPACING.md}}>
    <TouchableOpacity style={{minHeight: 44, justifyContent: 'center'}} accessibilityRole="button" disabled={pending} testID="campus-location-toggle" onPress={async () => {
      if (enabled) { cleanup.current?.(); cleanup.current = null; setEnabled(false); return; }
      setPending(true); setFailed(false);
      try {
        const stop = await startCampusLocation(() => { if (mounted.current) setFailed(true); });
        if (!mounted.current) { stop(); return; }
        cleanup.current = stop; setEnabled(true);
      } catch { if (mounted.current) setFailed(true); }
      finally { if (mounted.current) setPending(false); }
    }}>
      <Text style={{color: COLORS.primary}}>{t(pending ? 'campusNearby.pending' : enabled ? 'campusNearby.disable' : 'campusNearby.enable')}</Text>
    </TouchableOpacity>
    <Text style={{color: COLORS.textMuted}}>{t('campusNearby.description')}</Text>
    {enabled ? <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{CAMPUS_CONTEXTS.map(mode =>
      <TouchableOpacity key={mode.key} accessibilityRole="button" accessibilityState={{selected: context === mode.key}} style={{minHeight: 44, paddingHorizontal: 12, justifyContent: 'center'}} onPress={() => { setContext(mode.key); selectCampusContext(mode.key); }}>
        <Text style={{color: context === mode.key ? COLORS.primary : COLORS.text}}>{t(`campusNearby.${mode.key}`)}</Text>
      </TouchableOpacity>)}</View> : null}
    {failed ? <Text accessibilityRole="alert" style={{color: COLORS.text}}>{t('campusNearby.error')}</Text> : null}
  </View>;
}
