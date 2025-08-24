import React from "react";
import { View } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";

type SectionHeaderProps = {
	title: string;
	actionLabel?: string;
	onActionPress?: () => void;
};

export default function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
	const theme = useTheme();
	return (
		<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
			<Text variant="titleMedium" style={{ fontWeight: "800", color: theme.colors.onSurface }}>
				{title}
			</Text>
			{actionLabel ? (
				<Button mode="text" onPress={onActionPress} textColor={theme.colors.primary} compact>
					{actionLabel}
				</Button>
			) : null}
		</View>
	);
}



