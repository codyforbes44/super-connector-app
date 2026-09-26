export type AddressDraft = {
  customerName: string;
  street: string;
  streetSecondary: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
};

export const EMPTY_ADDRESS: AddressDraft = {
  customerName: "",
  street: "",
  streetSecondary: "",
  city: "",
  region: "",
  postalCode: "",
  isoCountry: "US",
};
