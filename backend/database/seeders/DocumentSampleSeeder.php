<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Http\Controllers\Api\Staff\DocumentController;
use App\Models\Document;
use App\Models\Parishioner;
use App\Models\SacramentalRecord;
use App\Models\User;
use App\Services\RecordRequests;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Placeholder files for trying the staff Documents page locally: a few
 * scanned register pages, two files on Maria Santos's record, and three scans
 * nobody has filed yet. Each is a one-page PDF that says it is a sample. Runs
 * only when APP_ENV=local. Safe to re-run: files already in place are skipped.
 */
class DocumentSampleSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $staff = User::query()->whereHas('role', fn ($q) => $q->where('role_name', UserRole::ParishStaff->value))->first();
        $added = 0;

        // One scan per register page, for the first entries of each register.
        $entries = SacramentalRecord::query()->with('sacramentType')->orderBy('book_number')->orderBy('page_number')->get()
            ->groupBy(fn (SacramentalRecord $r) => $r->sacramentType->name)
            ->flatMap(fn ($rs) => $rs->take(3));
        foreach ($entries as $r) {
            $name = strtolower($r->sacramentType->name)."-book-{$r->book_number}-page-{$r->page_number}.pdf";
            $added += $this->add($name, "{$r->sacramentType->name} register, book {$r->book_number}, page {$r->page_number}", $staff, ['record_id' => $r->record_id, 'label' => DocumentController::REGISTER_SCAN]);
        }

        $maria = Parishioner::query()->where('first_name', 'Maria')->where('last_name', 'Santos')->whereNotNull('chapel_id')->first();
        if ($maria) {
            $added += $this->add('maria-santos-valid-id.pdf', 'Valid ID of Maria Santos', $staff, ['parishioner_id' => $maria->parishioner_id, 'label' => 'Valid ID']);
            $added += $this->add('santos-family-marriage-contract.pdf', 'Marriage contract, Santos family', $staff, ['parishioner_id' => $maria->parishioner_id, 'label' => 'Other']);
        }

        foreach (['scan-2026-10-31-001.pdf', 'scan-2026-10-31-002.pdf', 'scan-2026-10-30-014.pdf'] as $name) {
            $added += $this->add($name, 'Unfiled scan from the office scanner', $staff, []);
        }

        $this->command?->info("Added {$added} sample documents.");
    }

    /**
     * @param  array<string, string>  $link
     */
    private function add(string $name, string $caption, ?User $by, array $link): int
    {
        $path = "documents/sample-{$name}";
        if (Document::query()->where('file_path', $path)->exists()) {
            return 0;
        }

        $pdf = $this->pdf("SAMPLE - {$caption}");
        Storage::disk(RecordRequests::disk())->put($path, $pdf);
        Document::query()->create([
            'file_name' => $name, 'file_path' => $path, 'file_type' => 'application/pdf', 'file_size' => strlen($pdf),
            'uploaded_by_user_id' => $by?->user_id, ...$link,
        ]);

        return 1;
    }

    /** A minimal one-page PDF showing one line of text. */
    private function pdf(string $text): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $stream = "BT /F1 18 Tf 72 720 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $out = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $body) {
            $offsets[] = strlen($out);
            $out .= ($i + 1)." 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($out);
        $out .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $out .= sprintf("%010d 00000 n \n", $o);
        }

        return $out.'trailer'."\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }
}
