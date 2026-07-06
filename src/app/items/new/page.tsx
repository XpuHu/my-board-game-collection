import { Boxes, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewItemPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">
          Добавить элемент
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Заглушка формы ручного создания Item для этапа 0.
        </p>
      </div>

      <form className="rounded-lg border bg-card p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Справочные данные</h2>
            <p className="text-sm text-muted-foreground">
              Рабочее сохранение появится после этапов 1-2.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Название</Label>
            <Input id="title" placeholder="Например, Ark Nova" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Тип элемента</Label>
            <Input id="type" placeholder="base_game, expansion, accessory..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              placeholder="Короткое описание элемента"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" disabled>
            <Save className="h-4 w-4" />
            Сохранить
          </Button>
        </div>
      </form>
    </main>
  );
}
