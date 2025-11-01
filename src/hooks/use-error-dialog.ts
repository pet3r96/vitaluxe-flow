import { useState } from "react";

interface ErrorDialogState {
  open: boolean;
  title: string;
  description: string;
}

export function useErrorDialog() {
  const [state, setState] = useState<ErrorDialogState>({
    open: false,
    title: "",
    description: "",
  });

  const showError = (title: string, description: string) => {
    setState({
      open: true,
      title,
      description,
    });
  };

  const closeError = () => {
    setState((prev) => ({ ...prev, open: false }));
  };

  return {
    errorDialog: state,
    showError,
    closeError,
  };
}
