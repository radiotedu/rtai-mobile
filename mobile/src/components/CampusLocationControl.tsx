import React, {useEffect, useRef, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {startCampusLocation} from '../services/campusLocationService';
import {COLORS, SPACING} from '../theme/theme';

export default function CampusLocationControl() {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup.current?.(); }; }, []);
  return <View style={{padding: SPACING.md}}>
    <TouchableOpacity accessibilityRole="button" disabled={pending} testID="campus-location-toggle" onPress={async () => {
      if (enabled) { cleanup.current?.(); cleanup.current = null; setEnabled(false); return; }
      setPending(true); setFailed(false);
      try {
        const stop = await startCampusLocation(() => { if (mounted.current) setFailed(true); });
        if (!mounted.current) { stop(); return; }
        cleanup.current = stop; setEnabled(true);
      } catch { if (mounted.current) setFailed(true); }
      finally { if (mounted.current) setPending(false); }
    }}>
      <Text style={{color: COLORS.primary}}>{pending ? 'Konum izni bekleniyor…' : enabled ? 'Kampüs önerilerini kapat' : 'Kampüs önerilerini aç'}</Text>
    </TouchableOpacity>
    <Text style={{color: COLORS.textMuted}}>Konumunuz yalnızca uygulama açıkken bu cihazda değerlendirilir.</Text>
    {failed ? <Text accessibilityRole="alert" style={{color: COLORS.text}}>Konum alınamadı. Hassas konum iznini ve konum ayarını kontrol edin.</Text> : null}
  </View>;
}
