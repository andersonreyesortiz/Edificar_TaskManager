import {
  AtSign, Calendar, CheckSquare, CircleDot, Hash, Link2, Phone, Star, Tags, Type, Users,
} from "lucide-react";
import type { ColumnType } from "@prisma/client";

/** Ícono de cada tipo de columna (sirve en componentes de servidor y de cliente). */
export const TYPE_ICONS: Record<ColumnType, React.ComponentType<{ size?: number; className?: string }>> = {
  STATUS: CircleDot,
  TEXT: Type,
  NUMBER: Hash,
  DATE: Calendar,
  PEOPLE: Users,
  DROPDOWN: Tags,
  CHECKBOX: CheckSquare,
  LINK: Link2,
  EMAIL: AtSign,
  PHONE: Phone,
  RATING: Star,
};
