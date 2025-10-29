import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const showInfo = (message: string, duration: number = 3000) => {
  return toast.info(message, { duration });
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};