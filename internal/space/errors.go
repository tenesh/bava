package space

import (
	"errors"
	"fmt"
)

// Refusals the user can act on. Each error returned for one wraps its
// sentinel, so a caller can word it in the user's language (errors.Is) while
// the message keeps the detail for the log.
var (
	ErrExists      = errors.New("exists")
	ErrNameEmpty   = errors.New("nameEmpty")
	ErrNameSlash   = errors.New("nameSlash")
	ErrNameDot     = errors.New("nameDot")
	ErrIntoItself  = errors.New("intoItself")
	ErrNotFolder   = errors.New("notFolder")
	ErrOnlyPage    = errors.New("onlyPage")
	ErrOutside     = errors.New("outside")
	ErrThroughLink = errors.New("throughLink")
	ErrNotSpace    = errors.New("notSpace")
)

// Codes lists every refusal, for mapping an error to its code.
var Codes = []error{
	ErrExists, ErrNameEmpty, ErrNameSlash, ErrNameDot, ErrIntoItself,
	ErrNotFolder, ErrOnlyPage, ErrOutside, ErrThroughLink, ErrNotSpace,
}

// Code is the refusal's code (the sentinel's text), or "" for any other
// failure, such as one from the file system.
func Code(err error) string {
	for _, code := range Codes {
		if errors.Is(err, code) {
			return code.Error()
		}
	}
	return ""
}

type refusal struct {
	msg  string
	code error
}

func (r refusal) Error() string { return r.msg }
func (r refusal) Unwrap() error { return r.code }

// refuse makes a refusal with a detailed message and its code.
func refuse(code error, format string, args ...any) error {
	return refusal{msg: fmt.Sprintf(format, args...), code: code}
}
