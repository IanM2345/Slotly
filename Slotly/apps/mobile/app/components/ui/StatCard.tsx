import React from "react";
import { View } from "react-native";
import { Surface, Text, useTheme, Chip } from "react-native-paper";

type StatCardProps = {
	value: string;
	label: string;
	deltaLabel?: string;
	deltaVariant?: "up" | "down";
};

export default function StatCard({ value, label, deltaLabel, deltaVariant = "up" }: StatCardProps) {
	const theme = useTheme();
	return (
		<Surface style={{ borderRadius: 16, padding: 16, backgroundColor: theme.colors.surface }} elevation={2}>
			<Text variant="headlineSmall" style={{ fontWeight: "800", color: theme.colors.onSurface }}>
				{value}
			</Text>
			<View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, justifyContent: "space-between" }}>
				<Text style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
				{deltaLabel ? (
					<Chip compact selectedColor={deltaVariant === "up" ? (theme.colors as any).success : theme.colors.error}>
						{deltaLabel}
					</Chip>
				) : null}
			</View>
		</Surface>
	);
}


