import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Camera, FileText, Trash2, Upload } from 'lucide-react';

export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  url: string;
}

interface AttachmentUploaderProps {
  quoteId?: string;
  invoiceId?: string;
  userId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

export function AttachmentUploader({
  quoteId,
  invoiceId,
  userId,
  attachments,
  onAttachmentsChange,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const uploadKey = `${file.name}-${Date.now()}`;
      setUploading(uploadKey);
      try {
        const contextId = quoteId || invoiceId;
        const filePath = `${userId}/${contextId}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-attachments')
          .upload(filePath, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('quote-attachments')
          .getPublicUrl(filePath);

        const row: Record<string, string | number | null> = {
          user_id: userId,
          quote_id: quoteId || null,
          invoice_id: invoiceId || null,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        };

        const { data: insertedRow, error: insertError } = await supabase
          .from('quote_attachments')
          .insert(row)
          .select()
          .single();

        if (insertError) throw insertError;

        const newAttachment: Attachment = {
          id: insertedRow.id,
          fileName: file.name,
          filePath,
          fileType: file.type,
          fileSize: file.size,
          url: urlData.publicUrl,
        };

        onAttachmentsChange([...attachments, newAttachment]);
        toast.success(`${file.name} uploaded`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(message);
      } finally {
        setUploading(null);
      }
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('quote-attachments')
        .remove([attachment.filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('quote_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
      toast.success(`${attachment.fileName} removed`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      toast.error(message);
    }
  };

  const isImage = (fileType: string) => fileType.startsWith('image/');

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/40 py-10 text-center transition-colors hover:border-primary/50 hover:bg-zinc-50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload attachments"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <Upload className="w-6 h-6 animate-bounce text-primary" />
            <span className="text-sm font-medium">Uploading…</span>
          </div>
        ) : (
          <>
            <Camera className="w-7 h-7 text-zinc-350" />
            <div>
              <p className="text-sm font-medium text-zinc-600">
                Drop photos or PDFs here
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                or click to browse (images, PDF)
              </p>
            </div>
          </>
        )}
      </div>

      {/* Thumbnail grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative rounded-xl border border-zinc-150 bg-zinc-50 overflow-hidden shadow-sm"
            >
              {isImage(att.fileType) ? (
                <img
                  src={att.url}
                  alt={att.fileName}
                  className="w-full h-24 object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-24 gap-1 px-2">
                  <FileText className="w-7 h-7 text-zinc-400" />
                  <span className="text-[10px] text-zinc-500 font-medium truncate w-full text-center">
                    {att.fileName}
                  </span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 rounded-lg bg-white/80 text-zinc-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(att);
                }}
                aria-label={`Remove ${att.fileName}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="px-2 py-1.5 border-t border-zinc-100 bg-white">
                <p className="text-[10px] text-zinc-500 truncate">{att.fileName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
