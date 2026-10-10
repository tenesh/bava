//go:build linux && cgo && !gtk3

// The Linux side of printing to PDF: a WebKitWebView of its own, in a GTK
// window never shown, prints an HTML page to a file through the print
// system's file printer, with no dialog. Called from print_linux.go.
//
// WebKit sends "load-changed" FINISHED after "load-failed", and a print
// operation "finished" after "failed": a failure is only noted when it is
// sent, and the print reported and its record freed once, at the end.

#include <gtk/gtk.h>
#include <webkit/webkit.h>
#include <stdint.h>
#include "_cgo_export.h"

typedef struct {
	uintptr_t handle;
	int settle_ms;
	GtkWidget *window;
	WebKitWebView *web;
	GtkPrintSettings *settings;
	GtkPageSetup *setup;
	char *failure;
} BavaPrint;

// Reports the print once and frees everything it held.
static void bava_finish(BavaPrint *p) {
	bavaPDFDone(p->handle, p->failure == NULL, p->failure ? p->failure : "");
	g_signal_handlers_disconnect_by_data(p->web, p);
	g_object_unref(p->settings);
	g_object_unref(p->setup);
	gtk_window_destroy(GTK_WINDOW(p->window));
	g_free(p->failure);
	g_free(p);
}

static void bava_fail(BavaPrint *p, const char *message) {
	if (p->failure == NULL) p->failure = g_strdup(message);
}

static void on_print_failed(WebKitPrintOperation *op, GError *error, gpointer data) {
	bava_fail(data, error ? error->message : "the print failed");
}

// Always the print operation's last word, after "failed" too.
static void on_print_finished(WebKitPrintOperation *op, gpointer data) {
	g_signal_handlers_disconnect_by_data(op, data);
	g_object_unref(op);
	bava_finish(data);
}

static gboolean bava_print_now(gpointer data) {
	BavaPrint *p = data;
	WebKitPrintOperation *op = webkit_print_operation_new(p->web);
	webkit_print_operation_set_print_settings(op, p->settings);
	webkit_print_operation_set_page_setup(op, p->setup);
	g_signal_connect(op, "failed", G_CALLBACK(on_print_failed), p);
	g_signal_connect(op, "finished", G_CALLBACK(on_print_finished), p);
	webkit_print_operation_print(op);
	return G_SOURCE_REMOVE;
}

static gboolean on_load_failed(WebKitWebView *web, WebKitLoadEvent event, char *uri, GError *error, gpointer data) {
	bava_fail(data, error ? error->message : "the page did not load");
	return TRUE;
}

// FINISHED comes last, after a failure too: print, or report the failure.
static void on_load_changed(WebKitWebView *web, WebKitLoadEvent event, gpointer data) {
	BavaPrint *p = data;
	if (event != WEBKIT_LOAD_FINISHED) return;
	g_signal_handlers_disconnect_by_data(web, p);
	if (p->failure != NULL) {
		bava_finish(p);
		return;
	}
	// A moment for layout and fonts to settle before the page is printed.
	g_timeout_add(p->settle_ms, bava_print_now, p);
}

void bavaPrintPDF(uintptr_t handle, const char *html, const char *path,
                  double width, double height,
                  double top, double right, double bottom, double left,
                  int background, int settleMs) {
	BavaPrint *p = g_new0(BavaPrint, 1);
	p->handle = handle;
	p->settle_ms = settleMs;

	char *uri = g_filename_to_uri(path, NULL, NULL);
	p->settings = gtk_print_settings_new();
	gtk_print_settings_set_printer(p->settings, "Print to File");
	gtk_print_settings_set(p->settings, GTK_PRINT_SETTINGS_OUTPUT_FILE_FORMAT, "pdf");
	gtk_print_settings_set(p->settings, GTK_PRINT_SETTINGS_OUTPUT_URI, uri);
	g_free(uri);

	gboolean landscape = width > height;
	GtkPaperSize *paper = gtk_paper_size_new_custom("bava", "Bava",
		landscape ? height : width, landscape ? width : height, GTK_UNIT_MM);
	p->setup = gtk_page_setup_new();
	gtk_page_setup_set_paper_size(p->setup, paper);
	gtk_page_setup_set_orientation(p->setup, landscape ? GTK_PAGE_ORIENTATION_LANDSCAPE : GTK_PAGE_ORIENTATION_PORTRAIT);
	gtk_page_setup_set_top_margin(p->setup, top, GTK_UNIT_MM);
	gtk_page_setup_set_right_margin(p->setup, right, GTK_UNIT_MM);
	gtk_page_setup_set_bottom_margin(p->setup, bottom, GTK_UNIT_MM);
	gtk_page_setup_set_left_margin(p->setup, left, GTK_UNIT_MM);
	gtk_paper_size_free(paper);

	p->web = WEBKIT_WEB_VIEW(webkit_web_view_new());
	webkit_settings_set_print_backgrounds(webkit_web_view_get_settings(p->web), background != 0);
	p->window = gtk_window_new();
	// The printable width in CSS pixels (96 to the inch), as the page lays out.
	gtk_window_set_default_size(GTK_WINDOW(p->window), (int)((width - left - right) * 96 / 25.4), 600);
	gtk_window_set_child(GTK_WINDOW(p->window), GTK_WIDGET(p->web));
	g_signal_connect(p->web, "load-failed", G_CALLBACK(on_load_failed), p);
	g_signal_connect(p->web, "load-changed", G_CALLBACK(on_load_changed), p);
	webkit_web_view_load_html(p->web, html, NULL);
}
