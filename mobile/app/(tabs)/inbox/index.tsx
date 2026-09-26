import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { formatPhone, relativeTime } from "@/format";
import { colors, space } from "@/theme";
import type { Conversation } from "@/types";
import { Banner, Empty, Screen } from "@/ui";

export default function InboxScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRows(await api.inbox(token, query.trim() || undefined));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load messages.");
    }
  }, [token, query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      {error ? <Banner message={error} /> : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search name or number"
        placeholderTextColor={colors.muted}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
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
        ListEmptyComponent={
          <Empty title="No conversations" detail="Texts to your business number show up here." />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/inbox/${item.id}`)}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{item.contact_name || formatPhone(item.contact_number)}</Text>
              <Text style={styles.time}>{relativeTime(item.last_message_at)}</Text>
            </View>
            <Text style={styles.preview} numberOfLines={1}>
              {item.last_message_preview || "No message yet"}
            </Text>
            {item.unread_count > 0 ? <Text style={styles.unread}>{item.unread_count} unread</Text> : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  time: { color: colors.muted, fontSize: 13 },
  preview: { color: colors.muted, fontSize: 14 },
  unread: { color: colors.primary, fontSize: 12, fontWeight: "700" },
});
