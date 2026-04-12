{{/*
Expand the name of the chart.
*/}}
{{- define "prism.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "prism.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "prism.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "prism.labels" -}}
helm.sh/chart: {{ include "prism.chart" . }}
{{ include "prism.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: prism
{{- end }}

{{/*
Selector labels
*/}}
{{- define "prism.selectorLabels" -}}
app.kubernetes.io/name: {{ include "prism.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Server labels
*/}}
{{- define "prism.server.labels" -}}
{{ include "prism.labels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Server selector labels
*/}}
{{- define "prism.server.selectorLabels" -}}
{{ include "prism.selectorLabels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Server fullname
*/}}
{{- define "prism.server.fullname" -}}
{{- printf "%s-server" (include "prism.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "prism.frontend.labels" -}}
{{ include "prism.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "prism.frontend.selectorLabels" -}}
{{ include "prism.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend fullname
*/}}
{{- define "prism.frontend.fullname" -}}
{{- printf "%s-frontend" (include "prism.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Agent labels
*/}}
{{- define "prism.agent.labels" -}}
{{ include "prism.labels" . }}
app.kubernetes.io/component: agent
{{- end }}

{{/*
Agent selector labels
*/}}
{{- define "prism.agent.selectorLabels" -}}
{{ include "prism.selectorLabels" . }}
app.kubernetes.io/component: agent
{{- end }}

{{/*
Agent fullname
*/}}
{{- define "prism.agent.fullname" -}}
{{- printf "%s-agent" (include "prism.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
