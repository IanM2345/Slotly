import React from "react";
import { View } from "react-native";
import { Icon, useTheme } from "react-native-paper";

export default function RatingStars({ rating = 4, size = 18 }: { rating?: number; size?: number }) {
	const theme = useTheme();
	return (
		<View style={{ flexDirection: "row" }}>
			{[0, 1, 2, 3, 4].map((i) => (
				<Icon key={i} source={i < Math.round(rating) ? "star" : "star-outline"} size={size} color={theme.colors.secondary} />
			))}
		</View>
	);
}





