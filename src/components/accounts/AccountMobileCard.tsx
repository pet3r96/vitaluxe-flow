import { memo } from "react";
import { MobileTableRow, MobileTableRowProps } from "@/components/responsive/MobileDataTable";

export const AccountMobileCard = memo(({ account, onView, onEdit, onDelete, onToggleStatus }: {
  account: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) => {
  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      admin: { variant: "destructive", label: "Admin" },
      doctor: { variant: "default", label: "Practice" },
      pharmacy: { variant: "secondary", label: "Pharmacy" },
      topline: { variant: "default", label: "Topline Rep" },
      downline: { variant: "secondary", label: "Downline Rep" },
      provider: { variant: "outline", label: "Provider" },
      staff: { variant: "outline", label: "Staff" },
      patient: { variant: "outline", label: "Patient" }
    };
    return roleMap[role] || { variant: "outline" as const, label: role };
  };

  const roleBadge = getRoleBadge(account.role);

  const mobileRowProps: MobileTableRowProps = {
    title: account.name || account.email,
    subtitle: account.email !== account.name ? account.email : undefined,
    fields: [
      {
        label: "Role",
        value: roleBadge.label,
        badge: true,
        badgeVariant: roleBadge.variant
      },
      {
        label: "Status",
        value: account.active ? "Active" : "Inactive",
        badge: true,
        badgeVariant: account.active ? "default" : "secondary"
      },
      {
        label: "Created",
        value: new Date(account.created_at).toLocaleDateString()
      },
      ...(account.parent_name ? [{
        label: "Parent",
        value: account.parent_name
      }] : []),
      ...(account.linked_topline_name ? [{
        label: "Linked Topline",
        value: account.linked_topline_name
      }] : [])
    ],
    actions: [
      {
        label: "View Details",
        onClick: onView
      },
      {
        label: "Edit",
        onClick: onEdit
      },
      {
        label: account.active ? "Deactivate" : "Activate",
        onClick: onToggleStatus
      },
      {
        label: "Delete",
        onClick: onDelete,
        variant: "destructive" as const
      }
    ]
  };

  return <MobileTableRow {...mobileRowProps} />;
});

AccountMobileCard.displayName = "AccountMobileCard";
