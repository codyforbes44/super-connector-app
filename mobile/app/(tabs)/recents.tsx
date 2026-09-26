import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { formatDuration, formatPhone, relativeTime } from "@/format";
import { colors, space } from "@/theme";
import type { CallRow } from "@/types";
import { Banner, Empty, Screen } from "@/ui";

export default function RecentsScreen() {
  const { token } = useAuth();
  const [rows, setRows] = useState<CallRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRows(await api.calls(token));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load call history.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

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
        ListEmptyComponent={<Empty title="No calls yet" detail="Answered and missed calls, with their summaries, land here." />}
        renderItem={({ item }) => {
          const other = item.direction === "inbound" ? item.from_number : item.to_number;
          return (
            <View style={styles.row}>
              <View style={styles.top}>
                <Text style={styles.who}>{formatPhone(other)}</Text>
                <Text style={styles.meta}>{relativeTime(item.started_at)}</Text>
              </View>
              <Text style={styles.meta}>
                {item.direction === "inbound" ? "Incoming" : "Outgoing"}
                {item.duration != null ? ` · ${formatDuration(item.duration)}` : ""}
                {item.status ? ` · ${item.status}` : ""}
              </Text>
              {item.intelligence?.summary ? <Text style={styles.summary}>{item.intelligence.summary}</Text> : null}
              <View style={styles.badges}>
                {item.intelligence?.intent ? <Badge label={item.intelligence.intent} /> : null}
                {item.intelligence?.urgency ? <Badge label={item.intelligence.urgency} /> : null}
                {item.intelligence?.sentiment ? <Badge label={item.intelligence.sentiment} /> : null}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  who: { color: colors.text, fontSize: 17, fontWeight: "700", flex: 1 },
  meta: { color: colors.muted, fontSize: 13 },
  summary: { color: colors.text, fontSize: 15, lineHeight: 21 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { backgroundColor: colors.cardRaised, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "600" },
});
