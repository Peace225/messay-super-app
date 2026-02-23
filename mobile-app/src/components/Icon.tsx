import React from 'react';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  library?: 'FontAwesome5' | 'MaterialIcons' | 'Ionicons';
}

export default function Icon({ name, size = 24, color = '#333', library = 'FontAwesome5' }: IconProps) {
  switch (library) {
    case 'MaterialIcons':
      return <MaterialIcons name={name as any} size={size} color={color} />;
    case 'Ionicons':
      return <Ionicons name={name as any} size={size} color={color} />;
    case 'FontAwesome5':
    default:
      return <FontAwesome5 name={name as any} size={size} color={color} />;
  }
}
