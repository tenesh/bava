package menu

// Set changes the state an item's When names, for the tests.
func (s *State) Set(key string, on bool) {
	switch key {
	case "hasSelection":
		s.HasSelection = on
	case "canPasteStyles":
		s.CanPasteStyles = on
	case "hasLocked":
		s.HasLocked = on
	case "hasDocument":
		s.HasDocument = on
	case "showsCanvas":
		s.ShowsCanvas = on
	case "hasSpace":
		s.HasSpace = on
	}
}
