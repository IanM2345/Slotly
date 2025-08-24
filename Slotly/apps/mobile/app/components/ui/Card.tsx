import React from "react";
import { Surface, useTheme } from "react-native-paper";

type UICardProps = React.ComponentProps<typeof Surface>;

export default function UICard({ style, elevation = 2, ...props }: UICardProps) {
	const theme = useTheme();
	return (
		<Surface
			style={[{ borderRadius: 16, backgroundColor: theme.colors.surface }, style]}
			elevation={elevation}
			{...props}
		/>
	);
}



