import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PatternType = "Autopilot" | "Authentic";

type AiPattern = {
  label: string;
  type: PatternType;
  evidence: string;
};

type AiReport = {
  summary: string;
  themes: string[];
  patterns: AiPattern[];
  philosophy: string;
  actions: string[];
};

const API_URL = "http://192.168.1.6:3000/api/reflect";
const COUNTDOWN_STEPS = [3, 2, 1];
const DIGITAL_DIET_WARNING =
  "Autopilot Loop: 1.5 hrs YouTube Shorts, 45 mins Nostalgic Audio";

const livePalette = {
  background: "#050505",
  backgroundSecondary: "#0d0d14",
  card: "rgba(255,255,255,0.06)",
  cardStrong: "rgba(255,255,255,0.1)",
  border: "rgba(138,43,226,0.28)",
  text: "#f5f2ff",
  textMuted: "#aaa5bf",
  accent: "#8a2be2",
  accentMuted: "#c5a9ff",
  warning: "#f97316",
};

const grayscalePalette = {
  background: "#080808",
  backgroundSecondary: "#101010",
  card: "rgba(255,255,255,0.04)",
  cardStrong: "rgba(255,255,255,0.06)",
  border: "rgba(151,151,151,0.2)",
  text: "#dfdfdf",
  textMuted: "#9a9a9a",
  accent: "#707070",
  accentMuted: "#a8a8a8",
  warning: "#9a9a9a",
};

export default function SahejScreen() {
  const [inputText, setInputText] = useState("");
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [digitalDietWarning, setDigitalDietWarning] = useState("");
  const [errorText, setErrorText] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const palette = isGrayscale ? grayscalePalette : livePalette;

  useEffect(() => {
    fadeAnim.stopAnimation();
    fadeAnim.setValue(0);

    if (!aiReport) {
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [aiReport, fadeAnim]);

  async function handleReflect() {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setErrorText("");
    setIsLoading(true);
    setAiReport(null);

    try {
      for (const step of COUNTDOWN_STEPS) {
        setCountdown(step);
        await delay(1000);
      }

      setCountdown(null);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "reflection",
          message: trimmed,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Reflection failed.");
      }

      const report = payload?.report as AiReport | undefined;
      if (!report) {
        throw new Error("The server returned an empty reflection.");
      }

      setAiReport(report);
      await triggerHapticFeedback(report.patterns);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setCountdown(null);
      setIsLoading(false);
    }
  }

  function handleDigitalDiet() {
    setDigitalDietWarning(DIGITAL_DIET_WARNING);
    setIsGrayscale(true);
  }

  const buttonLabel =
    countdown !== null ? `Breathe... ${countdown}` : isLoading ? "Reflecting..." : "Reflect";

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: palette.background,
          opacity: isGrayscale ? 0.94 : 1,
        },
      ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardShell}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.backdropOrb,
              {
                backgroundColor: palette.accent,
                opacity: isGrayscale ? 0.08 : 0.16,
              },
            ]}
          />

          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}>
            <Text style={[styles.kicker, { color: palette.accentMuted }]}>Conscious Companion</Text>
            <Text style={[styles.title, { color: palette.text }]}>Sahej</Text>
            <Text style={[styles.subtitle, { color: palette.textMuted }]}>
              Slow the loop, catch the signal, and turn what matters into action.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>The Capture Engine</Text>
            <Text style={[styles.sectionCopy, { color: palette.textMuted }]}>
              Drop in the thought you want to examine. Sahej will sit with it for a breath before
              reflecting it back.
            </Text>

            <TextInput
              multiline
              numberOfLines={7}
              placeholder="What are you building, avoiding, feeling, or trying to understand?"
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                {
                  color: palette.text,
                  backgroundColor: palette.backgroundSecondary,
                  borderColor: palette.border,
                },
              ]}
              value={inputText}
              onChangeText={setInputText}
              textAlignVertical="top"
            />

            <Pressable
              onPress={handleReflect}
              disabled={isLoading || !inputText.trim()}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: palette.accent,
                  opacity: isLoading || !inputText.trim() ? 0.55 : pressed ? 0.88 : 1,
                },
              ]}>
              {isLoading && countdown === null ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
              )}
            </Pressable>

            {errorText ? (
              <View
                style={[
                  styles.feedbackCard,
                  {
                    backgroundColor: "rgba(249,115,22,0.12)",
                    borderColor: "rgba(249,115,22,0.32)",
                  },
                ]}>
                <Text style={[styles.feedbackTitle, { color: livePalette.warning }]}>
                  Connection issue
                </Text>
                <Text style={[styles.feedbackBody, { color: palette.textMuted }]}>{errorText}</Text>
              </View>
            ) : null}
          </View>

          {digitalDietWarning ? (
            <View
              style={[
                styles.feedbackCard,
                {
                  backgroundColor: palette.cardStrong,
                  borderColor: palette.border,
                },
              ]}>
              <Text style={[styles.feedbackTitle, { color: palette.warning }]}>
                Digital diet alert
              </Text>
              <Text style={[styles.feedbackBody, { color: palette.text }]}>
                {digitalDietWarning}
              </Text>
            </View>
          ) : null}

          {aiReport ? (
            <Animated.View
              style={[
                styles.card,
                styles.reportCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Reflection Report</Text>
              <Text style={[styles.summaryText, { color: palette.text }]}>{aiReport.summary}</Text>

              <View style={styles.groupSpacing}>
                <Text style={[styles.groupTitle, { color: palette.accentMuted }]}>Themes</Text>
                <View style={styles.tagRow}>
                  {aiReport.themes.map((theme) => (
                    <View
                      key={theme}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: palette.cardStrong,
                          borderColor: palette.border,
                        },
                      ]}>
                      <Text style={[styles.tagText, { color: palette.text }]}>{theme}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.groupSpacing}>
                <Text style={[styles.groupTitle, { color: palette.accentMuted }]}>Patterns</Text>
                {aiReport.patterns.length ? (
                  aiReport.patterns.map((pattern) => (
                    <View
                      key={`${pattern.type}-${pattern.label}`}
                      style={[
                        styles.patternCard,
                        {
                          backgroundColor: palette.backgroundSecondary,
                          borderColor: palette.border,
                        },
                      ]}>
                      <View style={styles.patternHeader}>
                        <Text style={[styles.patternLabel, { color: palette.text }]}>
                          {pattern.label}
                        </Text>
                        <View
                          style={[
                            styles.patternBadge,
                            {
                              backgroundColor:
                                pattern.type === "Autopilot"
                                  ? "rgba(249,115,22,0.16)"
                                  : "rgba(138,43,226,0.18)",
                            },
                          ]}>
                          <Text
                            style={[
                              styles.patternBadgeText,
                              {
                                color:
                                  pattern.type === "Autopilot"
                                    ? livePalette.warning
                                    : palette.accentMuted,
                              },
                            ]}>
                            {pattern.type}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.patternEvidence, { color: palette.textMuted }]}>
                        {pattern.evidence}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.sectionCopy, { color: palette.textMuted }]}>
                    No clear pattern surfaced in this pass.
                  </Text>
                )}
              </View>

              <View style={styles.groupSpacing}>
                <Text style={[styles.groupTitle, { color: palette.accentMuted }]}>
                  Philosophical lens
                </Text>
                <Text style={[styles.sectionCopy, { color: palette.text }]}>{aiReport.philosophy}</Text>
              </View>

              <View style={styles.groupSpacing}>
                <Text style={[styles.groupTitle, { color: palette.accentMuted }]}>Actions</Text>
                {aiReport.actions.map((action) => (
                  <View key={action} style={styles.actionRow}>
                    <View
                      style={[
                        styles.actionDot,
                        { backgroundColor: isGrayscale ? palette.accentMuted : palette.accent },
                      ]}
                    />
                    <Text style={[styles.actionText, { color: palette.text }]}>{action}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          <Pressable
            onPress={handleDigitalDiet}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: palette.border,
                backgroundColor: palette.card,
                opacity: pressed ? 0.82 : 1,
              },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              Analyze Digital Diet
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {isGrayscale ? (
        <View
          pointerEvents="none"
          style={[styles.grayscaleOverlay, { backgroundColor: "rgba(100,100,100,0.12)" }]}
        />
      ) : null}
    </SafeAreaView>
  );
}

async function triggerHapticFeedback(patterns: AiPattern[]) {
  const hasAutopilot = patterns.some((pattern) => pattern.type === "Autopilot");
  const hasAuthentic = patterns.some((pattern) => pattern.type === "Authentic");

  if (hasAutopilot) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return;
  }

  if (hasAuthentic) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardShell: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 18,
  },
  backdropOrb: {
    position: "absolute",
    right: -70,
    top: -10,
    width: 220,
    height: 220,
    borderRadius: 999,
  },
  heroCard: {
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontSize: 38,
    fontWeight: "700",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  reportCard: {
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
  },
  sectionCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  input: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  feedbackCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  feedbackBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
  },
  groupSpacing: {
    gap: 10,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
  },
  patternCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  patternHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  patternLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  patternBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  patternBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  patternEvidence: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 7,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
