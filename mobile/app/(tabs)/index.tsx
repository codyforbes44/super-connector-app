import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth";
import { formatPhone, toE164 } from "@/format";
import { colors, space } from "@/theme";
import { Banner, Screen } from "@/ui";
import { useVoice, useVoiceSnapshot } from "@/voice/VoiceContext";

const KEYS: Array<{ digit: string; letters: string }> = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

export default function DialerScreen() {
  const { account, accountError } = useAuth();
  const voice = useVoice();
  const snapshot = useVoiceSnapshot();
  const numbers = account?.numbers ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const callerId = picked ?? account?.profile?.default_number ?? numbers[0]?.phone_number ?? null;
  const destination = toE164(digits);

  async function placeCall() {
    if (!callerId) {
      setError("Claim a business number on the web, then come back.");
      return;
    }
    if (!destination) {
      setError("Enter a full phone number.");
      return;
    }
    setError(null);
    try {
      await voice.call(destination, callerId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The call could not be placed.");
    }
  }

  return (
    <Screen>
      <View style={styles.body}>
        {accountError ? <Banner message={accountError} /> : null}
        {snapshot.error ? <Banner message={snapshot.error} tone="warning" /> : null}
        {error ? <Banner message={error} /> : null}
        <View style={styles.picker}>
          {numbers.length === 0 ? (
            <Text style={styles.pickerEmpty}>No business number is assigned to this account yet.</Text>
          ) : (
            numbers.map((number) => {
              const selected = number.phone_number === callerId;
              return (
                <Pressable
                  key={number.sid}
                  onPress={() => setPicked(number.phone_number)}
                  style={[styles.chip, selected ? styles.chipOn : null]}
                >
                  <Text style={styles.chipTitle}>{number.friendly_name || "Business line"}</Text>
                  <Text style={styles.chipNumber}>{formatPhone(number.phone_number)}</Text>
                </Pressable>
              );
            })
          )}
        </View>
        <Text style={styles.display}>{digits ? formatPhone(digits) || digits : "Enter a number"}</Text>
        <View style={styles.pad}>
          {KEYS.map((key) => (
            <Pressable
              key={key.digit}
              accessibilityLabel={key.digit}
              style={styles.key}
              onPress={() => setDigits((current) => (current + key.digit).slice(0, 16))}
              onLongPress={
                key.digit === "0"
                  ? () => setDigits((current) => (current.startsWith("+") ? current : `+${current}`).slice(0, 16))
                  : undefined
              }
            >
              <Text style={styles.keyDigit}>{key.digit}</Text>
              <Text style={styles.keyLetters}>{key.letters}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.actions}>
          <View style={styles.actionSpacer} />
          <Pressable
            accessibilityLabel="Call"
            onPress={() => void placeCall()}
            style={[styles.call, !destination || !callerId ? styles.callOff : null]}
          >
            <Text style={styles.callLabel}>Call</Text>
          </Pressable>
          <Pressable accessibilityLabel="Delete" onPress={() => setDigits((current) => current.slice(0, -1))} style={styles.delete}>
            <Text style={styles.deleteLabel}>{digits ? "Delete" : ""}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: space.md, paddingBottom: space.md },
  picker: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  pickerEmpty: { color: colors.muted, fontSize: 14 },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: "#1d2a44" },
  chipTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chipNumber: { color: colors.muted, fontSize: 12 },
  display: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "600",
    textAlign: "center",
    marginVertical: space.lg,
    minHeight: 42,
  },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  key: { width: "30%", alignItems: "center", paddingVertical: 12 },
  keyDigit: { color: colors.text, fontSize: 30, fontWeight: "500" },
  keyLetters: { color: colors.muted, fontSize: 11, letterSpacing: 1, height: 14 },
  actions: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
  actionSpacer: { flex: 1 },
  call: {
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 36,
    paddingVertical: 16,
  },
  callOff: { opacity: 0.45 },
  callLabel: { color: "#062117", fontSize: 18, fontWeight: "800" },
  delete: { flex: 1, alignItems: "center" },
  deleteLabel: { color: colors.muted, fontSize: 15, fontWeight: "600" },
});
