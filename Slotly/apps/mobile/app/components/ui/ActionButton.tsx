import React from "react";
import { Button, useTheme } from "react-native-paper";

type ActionButtonProps = React.ComponentProps<typeof Button> & {
	variant?: "primary" | "secondary";
};

export default function ActionButton({ variant = "primary", style, contentStyle, labelStyle, ...props }: ActionButtonProps) {
	const theme = useTheme();
	const background = variant === "primary" ? theme.colors.primary : theme.colors.secondary;
	const textColor = variant === "primary" ? theme.colors.onPrimary : theme.colors.onSecondary;
	return (
		<Button
			mode="contained"
			buttonColor={background}
			style={[{ borderRadius: 28 }, style]}
			contentStyle={[{ paddingVertical: 10 }, contentStyle]}
			labelStyle={[{ color: textColor, fontWeight: "700" }, labelStyle]}
			{...props}
		/>
	);
}


