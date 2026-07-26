import React, { ComponentProps, forwardRef } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = Omit<ComponentProps<typeof Pressable>, 'style'> & {
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
};

export const MotionPressable = forwardRef<View, MotionPressableProps>(function MotionPressable(
  {
    disabled,
    onPressIn,
    onPressOut,
    pressedScale = 0.98,
    style,
    ...props
  },
  ref,
) {
  const pressProgress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => {
    const progress = reduceMotion ? 0 : pressProgress.value;
    return {
      opacity: 1 - progress * 0.035,
      transform: [{ scale: 1 - progress * (1 - pressedScale) }],
    };
  }, [pressedScale, reduceMotion]);

  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      disabled={disabled}
      onPressIn={(event) => {
        pressProgress.value = withTiming(1, {
          duration: 110,
          reduceMotion: ReduceMotion.System,
        });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressProgress.value = withSpring(0, {
          damping: 19,
          stiffness: 300,
          mass: 0.55,
          reduceMotion: ReduceMotion.System,
        });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
});
