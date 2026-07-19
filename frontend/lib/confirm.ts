import { Alert, Platform } from 'react-native';

/**
 * Alert.alert renders its buttons and fires callbacks on iOS/Android but not on
 * web (React Native Web ignores the button array). This resolves to the user's
 * choice on every platform by falling back to window.confirm on web.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Confirm',
  destructive = false
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
