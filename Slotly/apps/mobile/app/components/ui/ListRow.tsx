import React from "react";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type ListRowProps = {
	label: string;
	value?: string;
};

export default function ListRow({ label, value }: ListRowProps) {
	const theme = useTheme();
	return (
		<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
			<Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: "600" }}>{label}</Text>
			<Text style={{ color: theme.colors.onSurface, fontWeight: "700" }}>{value ?? "—"}</Text>
		</View>
	);
}



