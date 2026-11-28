import React, { useEffect, useRef } from 'react';
import {
  Animated,
  AccessibilityInfo,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export default function MessayReveal({
  children,
  delay = 0,
  duration = 650,
  distance = 24,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!active) return;

        if (reduceMotion) {
          progress.setValue(1);
          return;
        }

        animation = Animated.sequence([
          Animated.delay(delay),
          Animated.timing(progress, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);

        animation.start();
      })
      .catch(() => {
        if (active) progress.setValue(1);
      });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [delay, duration, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.97, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
