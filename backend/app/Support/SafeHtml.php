<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Keeps only the formatting the announcement editor can make: paragraphs,
 * line breaks, bold, italic, underline, a heading, lists, and web, email, or
 * phone links. Anything else (pasted styles, scripts, images, attributes) is
 * dropped or unwrapped to its text. Mirrors sanitizeHtml on the frontend; this
 * is the copy that counts.
 */
final class SafeHtml
{
    private const ALLOWED = ['p', 'br', 'strong', 'em', 'u', 'h3', 'ul', 'ol', 'li', 'a'];

    private const RENAME = ['b' => 'strong', 'i' => 'em', 'div' => 'p', 'h1' => 'h3', 'h2' => 'h3', 'h4' => 'h3'];

    private const DROP = ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript'];

    public static function clean(string $html): string
    {
        $in = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $in->loadHTML('<?xml encoding="utf-8"?><body>'.$html.'</body>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $out = new DOMDocument;
        $root = $out->createElement('div');
        $out->appendChild($root);
        $body = $in->getElementsByTagName('body')->item(0);
        if ($body) {
            self::walk($body, $root, $out);
        }

        $html = '';
        foreach ($root->childNodes as $child) {
            $html .= $out->saveHTML($child);
        }

        return trim($html);
    }

    /** The text of cleaned HTML, with a space between blocks. */
    public static function text(string $html): string
    {
        $spaced = (string) preg_replace('#<(/p|/li|/h3|br)#i', ' <$1', $html);

        return trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($spaced), ENT_QUOTES | ENT_HTML5)));
    }

    private static function walk(DOMNode $from, DOMElement $to, DOMDocument $doc): void
    {
        foreach (iterator_to_array($from->childNodes) as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $to->appendChild($doc->createTextNode($child->textContent));

                continue;
            }
            if (! $child instanceof DOMElement) {
                continue;
            }
            $tag = strtolower($child->tagName);
            $tag = self::RENAME[$tag] ?? $tag;
            if (in_array($tag, self::DROP, true)) {
                continue;
            }
            if (! in_array($tag, self::ALLOWED, true)) {
                self::walk($child, $to, $doc);

                continue;
            }

            $el = $doc->createElement($tag);
            if ($tag === 'a') {
                $href = trim($child->getAttribute('href'));
                if (! preg_match('/^(https?:|mailto:|tel:)/i', $href)) {
                    self::walk($child, $to, $doc);

                    continue;
                }
                $el->setAttribute('href', $href);
                $el->setAttribute('rel', 'noopener noreferrer');
                $el->setAttribute('target', '_blank');
            }
            self::walk($child, $el, $doc);
            // Empty paragraphs and list items are left behind by Enter; they carry nothing.
            if (in_array($tag, ['p', 'h3', 'li'], true) && trim($el->textContent) === '') {
                continue;
            }
            $to->appendChild($el);
        }
    }
}
