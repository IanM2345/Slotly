export type ServiceType = "women" | "men" | "everyone";

export type AccountDetails = {
	name: string;
	email: string;
	phone: string;
	dob: string; // ISO date
	serviceType: ServiceType;
	avatarUri?: string;
};

export type PaymentMethodCard = {
	id: string;
	type: "card";
	brand: string; // e.g., Visa
	last4: string;
};

export type PaymentMethodMpesa = {
	id: string;
	type: "mpesa";
	mpesaPhone: string;
};

export type PaymentMethod = PaymentMethodCard | PaymentMethodMpesa;

export type Address = {
	country: string;
	city?: string;
	constituency?: string;
	street?: string;
	apartment?: string;
};

export type LanguageChoice = "auto" | "en-UK" | "en-US" | "sw" | "es" | "fr" | "ar" | "pt";

export type CountryChoice = string;

export type FamilyMember = {
	id: string;
	name: string;
	relation?: string;
	phone?: string;
	email?: string;
};

export type Review = {
	id: string;
	serviceName: string;
	rating: 1 | 2 | 3 | 4 | 5;
	comment?: string;
	photoUri?: string;
};

export type Feedback = {
	rating: 1 | 2 | 3 | 4 | 5;
	text?: string;
};

export type GiftCard = {
	id: string;
	label: string;
	balance: number;
	status: "active" | "archived";
};





