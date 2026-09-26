import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { formatDuration, formatPhone, relativeTime } from "@/format";
import { playUrl, stopPlayback } from "@/playback";
import { colors, space } from "@/theme";
import type { VoicemailRow } from "@/types";
import { Banner, Button, Empty, Screen } from "@/ui";

export default function VoicemailScreen() {
  const { token } = useAuth();
  const [rows, setRows] = useState<VoicemailRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRows(await api.voicemails(token));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load voicemail.");
    }
  }, [token]);

  useEffect(() => {
    void load();
    return () => {
      void stopPlayback();
    };
  }, [load]);

  async function play(row: VoicemailRow) {
    if (!token) return;
    if (playing === row.sid) {
      await stopPlayback();
      setPlaying(null);
      return;
    }
    setError(null);
    try {
      const url = await api.voicemailAudio(token, row.sid);
      await playUrl(url);
      setPlaying(row.sid);
    } catch (caught) {
      setPlaying(null);
      setError(caught instanceof Error ? caught.message : "Playback failed.");
    }
  }

  return (
    <Screen>
      {error ? <Banner message={error} /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.sid}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
        ListEmptyComponent={<Empty title="No voicemail" detail="Missed calls that leave a message show up here." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.from}>{formatPhone(item.from_number)}</Text>
              <Text style={styles.meta}>
                {relativeTime(item.started_at)}
                {item.duration != null ? ` · ${formatDuration(item.duration)}` : ""}
              </Text>
              {item.transcription ? <Text style={styles.transcript}>{item.transcription}</Text> : null}
            </View>
            <Button
              label={playing === item.sid ? "Stop" : "Play"}
              tone={playing === item.sid ? "quiet" : "primary"}
              onPress={() => void play(item)}
              disabled={!item.recording_url && playing !== item.sid}
            />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: space.sm,
  },
  copy: { gap: 4 },
  from: { color: colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13 },
  transcript: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
