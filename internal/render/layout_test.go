package render_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/tharabyte/bava/internal/render"
	"github.com/tharabyte/bava/internal/testutil"
)

func containersSource(t *testing.T) string {
	t.Helper()
	return testutil.ReadRepoFile(t, "testdata/golden/containers.d2")
}

// The canvas builds shapes from this geometry, so every node and every edge
// in the diagram has to appear in it: a node that is missing is a box the
// user typed and never got.
func TestLayoutCarriesEveryNodeAndConnection(t *testing.T) {
	result, err := render.Render(context.Background(), containersSource(t), render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the fixture did not compile: %+v", result.Errors)
	}

	shapes := map[string]render.LayoutShape{}
	for _, shape := range result.Layout.Shapes {
		shapes[shape.ID] = shape
	}

	// Two containers and six children, as the fixture declares.
	for _, id := range []string{
		"frontend", "frontend.editor", "frontend.canvas",
		"backend", "backend.compile", "backend.layout", "backend.render",
	} {
		shape, ok := shapes[id]
		if !ok {
			t.Errorf("%s is missing from the layout", id)
			continue
		}
		if shape.W <= 0 || shape.H <= 0 {
			t.Errorf("%s has no size: %+v", id, shape)
		}
		if shape.Label == "" {
			t.Errorf("%s lost its label", id)
		}
	}

	// A nested shape names the container it sits in, so conversion can put it
	// in a frame without parsing ids itself.
	if parent := shapes["frontend.editor"].Parent; parent != "frontend" {
		t.Errorf("frontend.editor parent = %q, want %q", parent, "frontend")
	}
	if parent := shapes["frontend"].Parent; parent != "" {
		t.Errorf("a top-level shape has parent %q, want none", parent)
	}

	if len(result.Layout.Connections) != 4 {
		t.Fatalf("connections = %d, want 4", len(result.Layout.Connections))
	}
	for _, connection := range result.Layout.Connections {
		if _, ok := shapes[connection.Src]; !ok {
			t.Errorf("connection %s starts at %q, which is not a shape", connection.ID, connection.Src)
		}
		if _, ok := shapes[connection.Dst]; !ok {
			t.Errorf("connection %s ends at %q, which is not a shape", connection.ID, connection.Dst)
		}
		if len(connection.Route) < 2 {
			t.Errorf("connection %s has no route", connection.ID)
		}
	}

	// The labelled edges keep their labels.
	labels := map[string]bool{}
	for _, connection := range result.Layout.Connections {
		if connection.Label != "" {
			labels[connection.Label] = true
		}
	}
	for _, want := range []string{"source", "svg"} {
		if !labels[want] {
			t.Errorf("no connection carries the label %q", want)
		}
	}
}

// Colours are deliberately absent: a generated shape arrives in Bava's own
// style, so nothing downstream can come to depend on D2's palette.
func TestLayoutCarriesNoColours(t *testing.T) {
	result, err := render.Render(context.Background(), containersSource(t), render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(result.Layout)
	if err != nil {
		t.Fatal(err)
	}
	lowered := strings.ToLower(string(encoded))
	for _, absent := range []string{"fill", "stroke", "opacity", "#"} {
		if strings.Contains(lowered, absent) {
			t.Errorf("the layout mentions %q: %s", absent, lowered)
		}
	}
}

// A source that does not compile has no layout to speak of, and says so the
// same way it says everything else: in Errors, with the call succeeding.
func TestLayoutIsEmptyWhenTheSourceDoesNotCompile(t *testing.T) {
	result, err := render.Render(context.Background(), "a -> ", render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) == 0 {
		t.Fatal("want diagnostics for a broken source")
	}
	if len(result.Layout.Shapes) != 0 || len(result.Layout.Connections) != 0 {
		t.Errorf("layout = %+v, want nothing", result.Layout)
	}
}

// A SQL table and a UML class carry their rows as Bava writes them, so the
// canvas can make them tables and classes rather than plain boxes.
func TestLayoutCarriesTableAndClassRows(t *testing.T) {
	source := `users: {
  shape: sql_table
  id: int {constraint: primary_key}
  team_id: int {constraint: [foreign_key; unique]}
  notes: text
}
User: {
  shape: class
  +email: string
  -hash: string
  +save(): bool
  \#notify(to User)
}
plain`
	result, err := render.Render(context.Background(), source, render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the fixture did not compile: %+v", result.Errors)
	}
	rows := map[string]string{}
	for _, shape := range result.Layout.Shapes {
		rows[shape.ID] = shape.Rows
	}
	if want := "id int pk\nteam_id int fk unique\nnotes text"; rows["users"] != want {
		t.Errorf("users rows = %q, want %q", rows["users"], want)
	}
	if want := "+ email: string\n- hash: string\n+ save(): bool\n# notify(to User)"; rows["User"] != want {
		t.Errorf("User rows = %q, want %q", rows["User"], want)
	}
	if rows["plain"] != "" {
		t.Errorf("a plain shape has rows %q", rows["plain"])
	}
}

// A link between two columns says which columns, as D2 knows them; a link
// to a whole table says none, wherever its route happens to end.
func TestLayoutNamesTheColumnsALinkJoins(t *testing.T) {
	source := `users: {
  shape: sql_table
  id: int
  team_id: int
}
teams: {
  shape: sql_table
  id: int
}
users.team_id -> teams.id
users -> teams`
	result, err := render.Render(context.Background(), source, render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the fixture did not compile: %+v", result.Errors)
	}
	var columns, whole *render.LayoutConnection
	for i := range result.Layout.Connections {
		c := &result.Layout.Connections[i]
		if c.SrcColumn != nil {
			columns = c
		} else {
			whole = c
		}
	}
	if columns == nil || *columns.SrcColumn != 1 || columns.DstColumn == nil || *columns.DstColumn != 0 {
		t.Errorf("column link = %+v, want columns 1 and 0", columns)
	}
	if whole == nil || whole.DstColumn != nil {
		t.Errorf("table link = %+v, want no columns", whole)
	}
}

// What D2 allows that Bava's rows must still say: a constraint Bava does not
// draw (kept as a word before the keys, part of the type), a column name with
// a space (quoted), and a method's void return (left out, as D2 draws a
// method with no return).
func TestLayoutRowsKeepWhatD2Allows(t *testing.T) {
	source := `users: {
  shape: sql_table
  id: int {constraint: [primary_key; not_null]}
  "first name": text
}
User: {
  shape: class
  +run(): void
}`
	result, err := render.Render(context.Background(), source, render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the fixture did not compile: %+v", result.Errors)
	}
	rows := map[string]string{}
	for _, shape := range result.Layout.Shapes {
		rows[shape.ID] = shape.Rows
	}
	if want := "id int not_null pk\n\"first name\" text"; rows["users"] != want {
		t.Errorf("users rows = %q, want %q", rows["users"], want)
	}
	if want := "+ run()"; rows["User"] != want {
		t.Errorf("User rows = %q, want %q", rows["User"], want)
	}
}

// A shape's icon comes through as written, a name or an address, for the
// canvas to look up by name; nothing reads the address.
func TestLayoutCarriesEachShapesIcon(t *testing.T) {
	source := "api: { icon: server }\ndb: Orders DB { icon: https://example.com/icons/postgresql.svg }\nplain\napi -> db"
	result, err := render.Render(context.Background(), source, render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("did not compile: %+v", result.Errors)
	}
	icons := map[string]string{}
	for _, shape := range result.Layout.Shapes {
		icons[shape.ID] = shape.Icon
		if shape.W <= 0 || shape.H <= 0 {
			t.Errorf("%s has no size", shape.ID)
		}
	}
	want := map[string]string{"api": "server", "db": "https://example.com/icons/postgresql.svg", "plain": ""}
	for id, icon := range want {
		if icons[id] != icon {
			t.Errorf("%s icon = %q, want %q", id, icons[id], icon)
		}
	}
	// D2 makes room for an icon inside its box: a shape with one is never
	// smaller than without, so the square the canvas makes of it is not either.
	without, err := render.Render(context.Background(), "api\ndb: Orders DB\nplain\napi -> db", render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	boxes := map[string]render.LayoutShape{}
	for _, shape := range without.Layout.Shapes {
		boxes[shape.ID] = shape
	}
	for _, shape := range result.Layout.Shapes {
		plain := boxes[shape.ID]
		if shape.W < plain.W || shape.H < plain.H {
			t.Errorf("%s is %vx%v with its icon, %vx%v without", shape.ID, shape.W, shape.H, plain.W, plain.H)
		}
	}
}

// Nothing is fetched for an icon, while the diagram is laid out or drawn:
// an address in the D2 reaches no server.
func TestRenderNeverFetchesAnIcon(t *testing.T) {
	var asked atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		asked.Add(1)
		w.Header().Set("Content-Type", "image/svg+xml")
		_, _ = w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>`))
	}))
	defer server.Close()
	for _, source := range []string{
		"a: { icon: " + server.URL + "/a.svg }",
		"a: { shape: image\n icon: " + server.URL + "/b.svg }",
		"t: { shape: sql_table\n icon: " + server.URL + "/c.svg\n id: int }",
	} {
		result, err := render.Render(context.Background(), source, render.Options{})
		if err != nil {
			t.Fatal(err)
		}
		if len(result.Errors) > 0 {
			t.Fatalf("%q did not compile: %+v", source, result.Errors)
		}
	}
	if n := asked.Load(); n != 0 {
		t.Errorf("the icon server was asked %d times", n)
	}
}
