// components/AvatarDisplay.tsx

import { getSignedPhotoUrl } from '@/services/imageService';
import { Colors } from '@/styles/theme';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface AvatarDisplayProps {
  avatarUrl?: string;
  size?: number;
  style?: ViewStyle;
}

export function AvatarDisplay({ avatarUrl, size = 60, style }: AvatarDisplayProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl || avatarUrl.startsWith('character:')) {
      setImageUri(null);
      return;
    }
    let cancelled = false;
    getSignedPhotoUrl(avatarUrl).then(url => {
      if (!cancelled) setImageUri(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [avatarUrl]);

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };

  if (avatarUrl?.startsWith('character:')) {
    const emoji = avatarUrl.replace('character:', '');
    return (
      <View style={[containerStyle, style]}>
        <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
      </View>
    );
  }

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[containerStyle, style] as any}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <Text style={{ fontSize: size * 0.5 }}>🍽️</Text>
    </View>
  );
}
