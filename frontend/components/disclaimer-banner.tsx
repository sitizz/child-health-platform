import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * The exact required medical disclaimer. Kept as a single exported constant so
 * every placement shows identical wording and it can be updated in one place.
 */
export const DISCLAIMER_TEXT =
  'Child Guard Health provides environmental health guidance and is not intended to diagnose, treat or replace professional medical advice.';

/**
 * Reusable notice banner shown on the login, home, and intelligence screens.
 * `style` lets each screen control its own outer spacing.
 */
export function DisclaimerBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.banner, style]} accessibilityRole="text">
      <Ionicons
        name="information-circle-outline"
        size={18}
        color="#92400E"
        style={styles.icon}
      />
      <Text style={styles.text}>{DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
