"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface OverwriteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemToOverwriteName?: string; // Optional: name of the item being overwritten for better context
}

const OverwriteConfirmationModal: React.FC<OverwriteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemToOverwriteName = "this entry",
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Entry Already Exists</AlertDialogTitle>
          <AlertDialogDescription>
            An entry for {itemToOverwriteName} already exists. Do you want to overwrite it with your new changes?
            This action will replace the previous entry.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm}>Overwrite</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OverwriteConfirmationModal;