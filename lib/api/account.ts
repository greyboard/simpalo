import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface AccountSettings {
  id: string;
  accountId: string;
  settings: {
    googlePlacesApiKey?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export async function fetchAccountSettings(): Promise<AccountSettings> {
  const { data } = await api.get("/account/settings");
  return data;
}

export async function updateAccountSettings(settings: {
  googlePlacesApiKey?: string;
  [key: string]: any;
}): Promise<AccountSettings> {
  const { data } = await api.put("/account/settings", settings);
  return data;
}
