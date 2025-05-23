import React, { useState, useEffect, useRef } from "react";
import {View,Text, TextInput, StyleSheet, TouchableOpacity, FlatList, Keyboard, Platform,} from "react-native";
import { NavigationProp, useNavigation, useRoute } from "@react-navigation/native";
import { AntDesign } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";
import { useUserStore } from "../stores/userStore";
import { useChatStore, Message } from "../stores/ChatStore";
import CustomText from "../components/CustomText";

export default function ChatScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute();
  const { groupId } = route.params as { groupId: string };
  const currentUser = useAuthStore((state) => state.user);
  const group = useGroupStore((state) => state.groups.find((g) => g.id === groupId));

  // ChatStore-Funktionen und State
  const { messages, loadMessages, sendMessage } = useChatStore();

  // userMap: Schneller Zugriff auf Benutzernamen anhand ihrer IDs
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Mitglieder der Gruppe laden und in userMap speichern
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // getGroupMembers: IDs aller Mitglieder
        const memberIds = await useGroupStore.getState().getGroupMembers(groupId);

        // hole zu jeder ID den User-Namen
        const memberDetails = await Promise.all(
          memberIds.map(async (id) => {
            const user = await useUserStore.getState().getUser(id);
            return user ? { id, name: user.name } : null;
          })
        );

        // Objekt: { userId: userName }
        const userMapping = memberDetails
          .filter((member) => member !== null)
          .reduce((acc, member) => {
            acc[member!.id] = member!.name;
            return acc;
          }, {} as Record<string, string>);
        setUserMap(userMapping);
      } catch (error) {
        console.error("Fehler beim Laden der Mitglieder:", error);
      }
    };

    fetchMembers();
  }, [groupId]);

  // Funktion, um Namen anzuzeigen
  const getSenderName = (senderId: string) => {
    return userMap[senderId] || "Unbekannt";
  };

  const [newMessage, setNewMessage] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Beim ersten Rendern (und bei Wechsel groupId) Nachrichten laden
  useEffect(() => {
    loadMessages(groupId);
  }, [groupId, loadMessages]);

  // Tastatur-Listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setKeyboardHeight(event.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Nachricht senden
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    await sendMessage(groupId, currentUser.uid, newMessage);
    setNewMessage("");
  };

  // Timestamp formatieren
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  // Nachrichten umdrehen, damit FlatList inverted korrekt läuft
  const reversedMessages = [...messages].reverse();

  return (
    <View style={styles.container}>
      {/* Fixierter Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          {/* Alter Pfeil */}
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <CustomText style={styles.title}>{group?.name || "Chat"}</CustomText>
      </View>

      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        keyExtractor={(item: Message) => item.id}
        renderItem={({ item, index }) => {
          const isSameSender =
            index < reversedMessages.length - 1 &&
            reversedMessages[index + 1].senderId === item.senderId;
          // Nur anzeigen, wenn der Absender wechselt und es nicht der aktuelle User ist
          const showSenderName = !isSameSender && item.senderId !== currentUser?.uid;

          return (
            <View
              style={[
                styles.messageContainer,
                item.senderId === currentUser?.uid
                  ? styles.sentMessage
                  : styles.receivedMessage,
              ]}
            >
              {showSenderName && (
                <CustomText style={styles.senderName}>{getSenderName(item.senderId)}</CustomText>
              )}
              <CustomText style={styles.messageText}>{item.text}</CustomText>
              <CustomText style={styles.timestamp}>{formatDate(item.timestamp)}</CustomText>
            </View>
          );
        }}
        inverted
        contentContainerStyle={styles.flatListContent}
        keyboardShouldPersistTaps="handled"
        style={styles.messageList}
      />

      {/* Eingabefeld */}
      <View style={[styles.inputContainer, { marginBottom: keyboardHeight }]}>
        <TextInput
          style={styles.input}
          placeholder="Nachricht schreiben..."
          placeholderTextColor="#666"
          value={newMessage}
          onChangeText={setNewMessage}
        />
        <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
          <AntDesign name="arrowright" size={30} color="#1C313B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C313B" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingTop: 70,
    paddingBottom: 20,
    position: "relative",
    backgroundColor: "#1C313B",
  },
  backButton: {
    position: "absolute",
    left: 15,
    paddingTop: 50,
  },
  backText: {
    fontSize: 24,
    color: "#C7E850",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
  },
  messageList: {
    flex: 1,
  },
  flatListContent: {
    flexGrow: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  /* Nachricht */
  messageContainer: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
  },
  sentMessage: {
    backgroundColor: "#C7E85D",
    alignSelf: "flex-end",
    marginRight: 10,
  },
  receivedMessage: {
    backgroundColor: "#E5E5E5",
    alignSelf: "flex-start",
    marginLeft: 10,
  },
  senderName: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  messageText: {
    fontSize: 16,
    color: "black",
  },
  timestamp: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    textAlign: "right",
  },
  /* Eingabefeld bleibt unten fixiert */
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: "#C7E85D",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  input: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "SpaceMono",
  },
  sendButton: {
    backgroundColor: "#C7E850",
    borderRadius: 30,
    padding: 5,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
    // Schatten für iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    // Elevation für Android
    elevation: 5,
  },
});
