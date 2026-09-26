import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatDuration, formatPhone } from "@/format";
import { colors, space } from "@/theme";
import { useVoice, useVoiceSnapshot } from "@/voice/VoiceContext";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function ActiveCallScreen() {
  const voice = useVoice();
  const snapshot = useVoiceSnapshot();
  const [pad, setPad] = useState(false);
  const [sent, setSent] = useState("");
  const [now, setNow] = useState(Date.now());
  const live = snapshot.phase === "active";

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const elapsed =
    live && snapshot.startedAt != null ? formatDuration(Math.floor((now - snapshot.startedAt) / 1000)) : null;
  const status =
    snapshot.phase === "ringing"
      ? "Incoming call"
      : snapshot.phase === "connecting"
        ? "Calling"
        : elapsed
          ? elapsed
          : "On a call";

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.party}>{formatPhone(snapshot.remoteParty) || snapshot.remoteParty || "Unknown"}</Text>
        <Text style={styles.route}>
          {snapshot.direction === "inbound" ? "To your business line" : "From your business line"}
        </Text>
        {snapshot.error ? <Text style={styles.error}>{snapshot.error}</Text> : null}
      </View>
      {pad ? (
        <View style={styles.pad}>
          <Text style={styles.sent}>{sent}</Text>
          <View style={styles.keys}>
            {KEYS.map((digit) => (
              <Pressable
                key={digit}
                style={styles.key}
                onPress={() => {
                  setSent((current) => `${current}${digit}`.slice(-16));
                  void voice.sendDigit(digit);
                }}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.controls}>
          <Round
            label={snapshot.muted ? "Unmute" : "Mute"}
            on={snapshot.muted}
            onPress={() => void voice.toggleMute()}
          />
          <Round
            label={snapshot.speaker ? "Speaker on" : "Speaker"}
            on={snapshot.speaker}
            onPress={() => void voice.toggleSpeaker()}
          />
          <Round label="Keypad" on={false} onPress={() => setPad(true)} />
        </View>
      )}
      <View style={styles.bottom}>
        {snapshot.phase === "ringing" ? (
          <View style={styles.answerRow}>
            <Pressable style={[styles.end, styles.decline]} onPress={() => void voice.reject()}>
              <Text style={styles.endLabel}>Decline</Text>
            </Pressable>
            <Pressable style={[styles.end, styles.accept]} onPress={() => void voice.accept()}>
              <Text style={styles.acceptLabel}>Accept</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.end} onPress={() => void voice.hangup()}>
            <Text style={styles.endLabel}>Hang up</Text>
          </Pressable>
        )}
        {pad ? (
          <Pressable onPress={() => setPad(false)}>
            <Text style={styles.hide}>Hide keypad</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Round({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.round, on ? styles.roundOn : null]}>
      <Text style={[styles.roundLabel, on ? styles.roundLabelOn : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1016", padding: space.lg, justifyContent: "space-between" },
  top: { alignItems: "center", gap: 8, marginTop: space.xl },
  status: { color: colors.muted, fontSize: 15, letterSpacing: 0.4 },
  party: { color: colors.text, fontSize: 34, fontWeight: "700", textAlign: "center" },
  route: { color: colors.muted, fontSize: 15 },
  error: { color: colors.warning, textAlign: "center", marginTop: space.sm },
  controls: { flexDirection: "row", justifyContent: "space-evenly" },
  round: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cardRaised,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  roundOn: { backgroundColor: colors.text },
  roundLabel: { color: colors.text, fontWeight: "700", textAlign: "center" },
  roundLabelOn: { color: colors.background },
  pad: { gap: space.sm },
  sent: { color: colors.text, textAlign: "center", fontSize: 22, minHeight: 28 },
  keys: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  key: { width: "30%", alignItems: "center", paddingVertical: 10 },
  keyText: { color: colors.text, fontSize: 28 },
  bottom: { alignItems: "center", gap: space.md, marginBottom: space.lg },
  answerRow: { flexDirection: "row", gap: space.md },
  end: { backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 36, paddingVertical: 16 },
  decline: { backgroundColor: colors.danger },
  accept: { backgroundColor: colors.success },
  endLabel: { color: colors.text, fontSize: 18, fontWeight: "800" },
  acceptLabel: { color: "#062117", fontSize: 18, fontWeight: "800" },
  hide: { color: colors.muted, fontSize: 15 },
});
