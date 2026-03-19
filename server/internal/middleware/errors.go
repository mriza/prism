package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

// Standard error types
var (
	ErrNotFound          = errors.New("not found")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrForbidden         = errors.New("forbidden")
	ErrBadRequest        = errors.New("bad request")
	ErrInternal          = errors.New("internal error")
	ErrTimeout           = errors.New("request timeout")
	ErrConflict          = errors.New("conflict")
	ErrServiceUnavailable = errors.New("service unavailable")
)

// APIError represents a structured API error
type APIError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	Details    string `json:"details,omitempty"`
	StatusCode int    `json:"-"`
}

func (e *APIError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s", e.Message, e.Details)
	}
	return e.Message
}

// Error types for specific errors
type (
	NotFoundError    struct{ Message string }
	UnauthorizedError struct{ Message string }
	ForbiddenError   struct{ Message string }
	BadRequestError  struct{ Message string }
	ConflictError    struct{ Message string }
)

func (e *NotFoundError) Error() string    { return e.Message }
func (e *UnauthorizedError) Error() string { return e.Message }
func (e *ForbiddenError) Error() string    { return e.Message }
func (e *BadRequestError) Error() string   { return e.Message }
func (e *ConflictError) Error() string     { return e.Message }

// WrapError wraps an error with context
func WrapError(err error, context string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", context, err)
}

// IsNotFound checks if error is NotFound
func IsNotFound(err error) bool {
	var notFound *NotFoundError
	return errors.As(err, &notFound) || errors.Is(err, ErrNotFound)
}

// IsUnauthorized checks if error is Unauthorized
func IsUnauthorized(err error) bool {
	var unauthorized *UnauthorizedError
	return errors.As(err, &unauthorized) || errors.Is(err, ErrUnauthorized)
}

// IsTimeout checks if error is timeout
func IsTimeout(err error) bool {
	return errors.Is(err, context.DeadlineExceeded) || errors.Is(err, ErrTimeout)
}

// HTTPStatusFromError returns HTTP status code for error
func HTTPStatusFromError(err error) int {
	if err == nil {
		return http.StatusOK
	}

	if IsNotFound(err) {
		return http.StatusNotFound
	}
	if IsUnauthorized(err) {
		return http.StatusUnauthorized
	}
	var fe *ForbiddenError
	if errors.As(err, &fe) {
		return http.StatusForbidden
	}
	var be *BadRequestError
	if errors.As(err, &be) {
		return http.StatusBadRequest
	}
	var ce *ConflictError
	if errors.As(err, &ce) {
		return http.StatusConflict
	}
	if IsTimeout(err) {
		return http.StatusGatewayTimeout
	}
	return http.StatusInternalServerError
}

// ErrorResponse writes error response
func ErrorResponse(w http.ResponseWriter, err error) {
	status := HTTPStatusFromError(err)
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	
	apiErr := &APIError{
		Code:       http.StatusText(status),
		Message:    err.Error(),
		StatusCode: status,
	}
	
	// Don't expose internal errors to clients
	if status == http.StatusInternalServerError {
		apiErr.Message = "An internal error occurred"
	}
	
	// Write JSON response
	fmt.Fprintf(w, `{"error":%q,"code":%q}`, apiErr.Message, apiErr.Code)
}

// JSONError writes a JSON error response with custom message
func JSONError(w http.ResponseWriter, statusCode int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	fmt.Fprintf(w, `{"error":%q,"code":%q}`, message, code)
}
