import React from "react";
import { Chip as PaperChip, useTheme } from "react-native-paper";

type ChipProps = React.ComponentProps<typeof PaperChip> & {
	selected?: boolean;
};

export default function Chip({ selected = false, style, ...props }: ChipProps) {
	const theme = useTheme();
	const containerStyle = [
		{
			borderRadius: 999,
			backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
		},
		style,
	];
	return <PaperChip style={containerStyle} selected={selected} {...props} />;
}



