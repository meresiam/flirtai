"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { DesenroloForm, type DesenroloFormValues } from "@/components/desenrolo/desenrolo-form";
import { useFlirtStore } from "@/store/use-flirt-store";

export default function NewDesenroloPage() {
  const router = useRouter();
  const createContact = useFlirtStore((s) => s.createContact);

  async function handleSubmit(values: DesenroloFormValues) {
    const newId = await createContact({
      kind: "desenrolo",
      name: values.name,
      avatarUrl: values.avatarUrl || undefined,
      ratingBeleza: values.ratings.beleza,
      ratingInteligencia: values.ratings.inteligencia,
      ratingLealdade: values.ratings.lealdade,
      ratingRespeito: values.ratings.respeito,
      ratingVestimenta: values.ratings.vestimenta,
      location: values.location || undefined,
      metContext: values.metContext || undefined,
      source: values.source || undefined,
      instagramHandle: values.instagramHandle || undefined,
      age: values.age,
      tags: values.tags,
      notes: values.notes || undefined,
    });
    if (!newId) {
      throw new Error("Não consegui criar o perfil agora. Tenta de novo.");
    }
    router.push(`/desenrolos/${newId}`);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070913]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/desenrolos"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Desenrolos</span>
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <h1 className="text-sm font-medium text-white/90">Novo desenrolo</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white/90">
            Quem é o desenrolo?
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Preenche o que você sabe agora. Tudo pode ser ajustado depois.
          </p>
        </div>

        <DesenroloForm
          submitLabel="Criar e abrir conversa"
          busyLabel="Criando..."
          onSubmit={handleSubmit}
          onCancel={() => router.push("/desenrolos")}
        />
      </main>
    </div>
  );
}
