import { Category } from "@/types/store";
import { Sparkles, Flower2, User, Globe, Flag, LayoutGrid } from "lucide-react";

interface CategoryFilterProps {
  categories: Category[];
  selected: string;
  onSelect: (slug: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  masculino: <User className="h-5 w-5" />,
  feminino: <Flower2 className="h-5 w-5" />,
  unissex: <Sparkles className="h-5 w-5" />,
  importados: <Globe className="h-5 w-5" />,
  nacionais: <Flag className="h-5 w-5" />,
};

const CategoryFilter = ({ categories, selected, onSelect }: CategoryFilterProps) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
      <button
        onClick={() => onSelect("")}
        className={`flex flex-col items-center gap-2 px-6 py-4 rounded-none transition-all duration-300 min-w-[110px] border ${
          selected === ""
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-white text-slate-500 border-black/5 hover:border-primary/20 hover:text-primary"
        }`}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Todos</span>
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={`flex flex-col items-center gap-2 px-6 py-4 rounded-none transition-all duration-300 min-w-[110px] border ${
            selected === cat.slug
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-white text-slate-500 border-black/5 hover:border-primary/20 hover:text-primary"
          }`}
        >
          {categoryIcons[cat.slug] || <Sparkles className="h-4 w-4 shrink-0" />}
          <span className="text-[10px] font-bold uppercase tracking-widest">{cat.name}</span>
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
