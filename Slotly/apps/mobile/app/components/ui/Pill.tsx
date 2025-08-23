import React from "react";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type PillProps = {
	label: string;
	variant?: "default" | "success" | "warning" | "error";
};

export default function Pill({ label, variant = "default" }: PillProps) {
	const theme = useTheme();

	const backgroundByVariant: Record<string, string> = {
		default: theme.colors.surfaceVariant,
		success: "rgba(34,197,94,0.15)",
		warning: "rgba(245,158,11,0.18)",
		error: "rgba(239,68,68,0.15)",
	};

	const colorByVariant: Record<string, string> = {
		default: theme.colors.onSurface,
		success: (theme.colors as any).success,
		warning: (theme.colors as any).warning,
		error: theme.colors.error,
	};

	return (
		<View style={{ alignSelf: "flex-start", backgroundColor: backgroundByVariant[variant], paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 }}>
			<Text style={{ fontSize: 12, fontWeight: "700", color: colorByVariant[variant], letterSpacing: 0.3 }}>{label}</Text>
		</View>
	);
}


