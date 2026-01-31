import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface User {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN" | "OWNER" | "SUPERADMIN";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  account: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const { data } = await api.get("/user/profile");
  return data;
}

export async function updateUserProfile(profileData: {
  name?: string;
  email?: string;
  password?: string;
  currentPassword?: string;
}): Promise<User> {
  const { data } = await api.put("/user/profile", profileData);
  return data;
}

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get("/users");
  return data;
}

export async function createUser(userData: {
  email: string;
  password: string;
  name: string;
  role?: "USER" | "ADMIN";
}): Promise<User> {
  const { data } = await api.post("/users", userData);
  return data;
}

export async function updateUser(
  userId: string,
  userData: {
    name?: string;
    email?: string;
    password?: string;
    role?: "USER" | "ADMIN" | "OWNER" | "SUPERADMIN";
    isActive?: boolean;
  }
): Promise<User> {
  const { data } = await api.put(`/users/${userId}`, userData);
  return data;
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}
