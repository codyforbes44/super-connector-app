import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, space } from "@/theme";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      {children}
    </SafeAreaView>
  );
}

export function Heading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

export function Banner({ message, tone = "danger" }: { message: string; tone?: "danger" | "warning" }) {
  return (
    <View style={[styles.banner, tone === "warning" ? styles.bannerWarning : styles.bannerDanger]}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "danger" | "quiet" | "success";
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "danger" ? styles.danger : null,
        tone === "quiet" ? styles.quiet : null,
        tone === "success" ? styles.success : null,
        tone === "primary" ? styles.primary : null,
        disabled || busy ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.detail, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heading: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  detail: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  banner: { marginHorizontal: space.lg, marginBottom: space.sm, borderRadius: 12, padding: space.md },
  bannerDanger: { backgroundColor: "#3a2226" },
  bannerWarning: { backgroundColor: "#3a321f" },
  bannerText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  empty: { padding: space.xl, gap: space.sm },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: { borderRadius: 14, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  success: { backgroundColor: colors.success },
  quiet: { backgroundColor: colors.cardRaised },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
});
