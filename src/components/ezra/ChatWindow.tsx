import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { CheckIcon, CopyIcon, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import orbImage from "@/assets/ezra-orb.jpg";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTED_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/chat-shared";

const SUGGESTIONS = [
  "اشرحلي الـ pulpitis بطريقة بسيطة",
  "حضّرلي 5 MCQs على الـ endodontics",
  "نهاري كان طويل… خلينا نحكيو",
];

function messageText(message: UIMessage) {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <MessageAction
      tooltip={copied ? "تنسخ" : "نسخ"}
      label="نسخ"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="text-muted-foreground hover:text-rose-soft"
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </MessageAction>
  );
}

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return (
    <PromptInputHeader className="px-3 pt-3">
      <Attachments variant="inline" className="ml-0">
        {attachments.files.map((file) => (
          <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
            <AttachmentPreview />
            <AttachmentInfo className="max-w-[140px]" />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      tooltip="إرفاق صورة أو ملف"
      onClick={() => attachments.openFileDialog()}
      aria-label="إرفاق"
    >
      <Paperclip className="size-4" />
    </PromptInputButton>
  );
}

function DictationButton() {
  const controller = usePromptInputController();
  return (
    <SpeechInput
      lang="ar"
      size="icon-sm"
      variant="ghost"
      aria-label="إملاء بالصوت"
      className="bg-transparent text-muted-foreground hover:bg-accent hover:text-rose-soft"
      onTranscriptionChange={(text) => {
        const current = controller.textInput.value;
        controller.textInput.setInput(current ? `${current} ${text}` : text);
      }}
    />
  );
}

function Composer({
  status,
  onSubmit,
  onStop,
}: {
  status: ReturnType<typeof useChat>["status"];
  onSubmit: (message: PromptInputMessage) => void;
  onStop: () => void;
}) {
  return (
    <PromptInput
      onSubmit={onSubmit}
      accept={ACCEPTED_ATTACHMENTS}
      multiple
      maxFiles={MAX_ATTACHMENTS}
      maxFileSize={MAX_ATTACHMENT_BYTES}
      onError={(error) =>
        toast.error(
          error.code === "max_file_size"
            ? "الملف كبير بزاف (الحد 10 ميغا)."
            : error.code === "max_files"
              ? `الحد ${MAX_ATTACHMENTS} مرفقات.`
              : "هاد النوع من الملفات مازال ما نقبلوش (صور، PDF، نص).",
        )
      }
      className="surface-luxe rounded-3xl [&_[data-slot=input-group]]:rounded-3xl [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent"
    >
      <ComposerAttachments />
      <PromptInputTextarea
        autoFocus
        dir="auto"
        placeholder="احكيلي…"
        className="min-h-12 text-[15px]"
      />
      <PromptInputFooter className="px-2 pb-2">
        <PromptInputTools>
          <AttachButton />
          <DictationButton />
        </PromptInputTools>
        <PromptInputSubmit
          status={status}
          onStop={onStop}
          variant="glow"
          className="rounded-full"
          aria-label="إرسال"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}

export function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const queryClient = useQueryClient();
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
        },
        prepareSendMessagesRequest: ({ messages, id, headers }) => ({
          ...(headers ? { headers } : {}),
          body: { threadId: id, message: messages[messages.length - 1] },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      focusComposer();
    },
    onError: (err) => toast.error(err.message || "عزرا ما قدرش يرد. جرّب مرة أخرى."),
  });

  const wrapper = useRef<HTMLDivElement>(null);
  function focusComposer() {
    requestAnimationFrame(() => wrapper.current?.querySelector("textarea")?.focus());
  }
  useEffect(() => focusComposer(), []);

  function submit(message: PromptInputMessage) {
    const text = message.text.trim();
    if (!text && !message.files.length) return;
    void sendMessage({ text, files: message.files });
    focusComposer();
  }

  const empty = messages.length === 0;

  return (
    <div ref={wrapper} className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6 px-4 py-6">
          {empty && (
            <div className="flex flex-col items-center gap-5 pt-10 text-center animate-fade-up">
              <img
                src={orbImage}
                alt=""
                width={1024}
                height={1024}
                className="size-28 rounded-full mix-blend-screen animate-orb-spin"
              />
              <div className="space-y-1.5">
                <p className="font-arabic-display text-2xl">شو في بالك اليوم؟</p>
                <p className="text-sm text-muted-foreground">
                  احكيلي، ابعثلي صورة، ولا خلينا نراجعو مع بعض.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void sendMessage({ text: suggestion })}
                    className="rounded-full border border-border bg-card/60 px-3.5 py-2 text-xs text-rose-soft transition-colors hover:bg-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const text = messageText(message);
            const files = message.parts.flatMap((part, i) =>
              part.type === "file" ? [{ ...part, id: `${message.id}-${i}` }] : [],
            );
            const isLastAssistant = message.role === "assistant" && index === messages.length - 1;
            return (
              <Message key={message.id} from={message.role}>
                {files.length > 0 && (
                  <Attachments
                    variant={
                      files.every((f) => f.mediaType.startsWith("image/")) ? "grid" : "inline"
                    }
                    className={message.role === "user" ? "ml-0 ms-auto" : "ml-0"}
                  >
                    {files.map((file) => (
                      <Attachment key={file.id} data={file}>
                        <AttachmentPreview />
                        {!file.mediaType.startsWith("image/") && (
                          <AttachmentInfo className="max-w-[160px]" />
                        )}
                      </Attachment>
                    ))}
                  </Attachments>
                )}
                {text && (
                  <MessageContent dir="auto">
                    {message.role === "assistant" ? (
                      <MessageResponse isAnimating={isLastAssistant && status === "streaming"}>
                        {text}
                      </MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap">{text}</p>
                    )}
                  </MessageContent>
                )}
                {message.role === "assistant" &&
                  text &&
                  !(isLastAssistant && status === "streaming") && (
                    <MessageActions className="-mt-1">
                      <CopyButton text={text} />
                    </MessageActions>
                  )}
              </Message>
            );
          })}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="text-sm">لحظة، أنا نفكّر…</Shimmer>
              </MessageContent>
            </Message>
          )}
          {error && status === "error" && (
            <p className="text-center text-sm text-destructive">
              {error.message || "عزرا ما قدرش يرد. جرّب مرة أخرى."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
        <PromptInputProvider>
          <Composer status={status} onSubmit={submit} onStop={stop} />
        </PromptInputProvider>
      </div>
    </div>
  );
}