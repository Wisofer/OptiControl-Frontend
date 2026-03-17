import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Settings as SettingsIcon,
  User,
  Building2,
  DollarSign,
  Sun,
  Moon,
  Users,
  MessageCircle,
} from "lucide-react";
import { Card, Button, Input, Modal, EmptyState, ConfirmModal, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, TableSkeleton } from "../components/ui";
import { useSettings } from "../hooks/useSettings";
import { useUsers } from "../hooks/useUsers";
import { useWhatsAppTemplates } from "../hooks/useWhatsAppTemplates";
import { useAuth } from "../contexts/AuthContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import { cn } from "../utils/cn";
import { APP_NAME } from "../config/brand.js";

const emptyUserForm = () => ({ usuario: "", nombreCompleto: "", contrasena: "", rol: "Usuario", estado: "Activo" });
const emptyTemplateForm = () => ({ nombre: "", mensaje: "", activa: true, predeterminada: false });
const WHATSAPP_VARS = "{NombreCliente}, {CodigoCliente}, {NumeroFactura}, {Monto}, {Mes}, {Categoria}, {Estado}, {FechaCreacion}, {EnlacePDF}";

function SectionTitle({ icon: Icon, title, className }) {
  return (
    <div className={cn("flex items-center gap-2 mb-4", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
    </div>
  );
}

export function Settings() {
  const { settings, loading, error, update } = useSettings();
  const { users, loading: usersLoading, create: createUser, update: updateUser, remove: removeUser } = useUsers();
  const { user } = useAuth();
  const {
    templates,
    loading: templatesLoading,
    create: createTemplate,
    update: updateTemplate,
    remove: removeTemplate,
  } = useWhatsAppTemplates();
  const snackbar = useSnackbar();
  const [form, setForm] = useState({ companyName: "", email: "", phone: "", address: "", currency: "" });
  const [exchangeRateLocal, setExchangeRateLocal] = useState("");
  const [savingExchangeRate, setSavingExchangeRate] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm());
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState(null);
  const [deleteTemplateLoading, setDeleteTemplateLoading] = useState(false);

  useEffect(() => {
    setForm({
      companyName: settings.companyName ?? "",
      email: settings.email ?? "",
      phone: settings.phone ?? "",
      address: settings.address ?? "",
      currency: settings.currency ?? "",
    });
  }, [settings]);

  useEffect(() => {
    const rate = settings.exchangeRate;
    setExchangeRateLocal(rate != null && rate !== 0 ? Number(rate).toFixed(2) : "");
  }, [settings.exchangeRate]);

  const updateKey = (key, value) => {
    update({ [key]: value });
  };

  const handleSaveExchangeRate = async () => {
    const raw = String(exchangeRateLocal).replace(",", ".").trim();
    const value = parseFloat(raw);
    if (Number.isNaN(value) || value <= 0) {
      snackbar.error("Escribe una tasa válida mayor que 0 (ej: 36.8 o 36,8)");
      return;
    }
    setSavingExchangeRate(true);
    try {
      await update({ exchangeRate: value });
      snackbar.success("Tipo de cambio guardado. Los totales en C$ usarán esta tasa.");
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el tipo de cambio");
    }
    setSavingExchangeRate(false);
  };

  const handleSubmitAgency = async (e) => {
    e.preventDefault();
    if (!form.companyName?.trim()) {
      snackbar.error("El nombre de la empresa es obligatorio.");
      return;
    }
    try {
      await update({
        companyName: form.companyName.trim(),
        email: form.email?.trim() ?? "",
        phone: form.phone?.trim() ?? "",
        address: form.address?.trim() ?? "",
        currency: form.currency || settings.currency || "NIO",
      });
      snackbar.success("Datos de la agencia guardados");
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar");
    }
  };

  const openCreateUser = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm());
    setUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUserId(u.id);
    setUserForm({
      usuario: u.usuario ?? "",
      nombreCompleto: u.nombreCompleto ?? "",
      contrasena: "",
      rol: u.rol ?? "Usuario",
      estado: u.estado ?? "Activo",
    });
    setUserModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        const body = { usuario: userForm.usuario, nombreCompleto: userForm.nombreCompleto, rol: userForm.rol, estado: userForm.estado };
        if (userForm.contrasena.trim()) body.contrasena = userForm.contrasena;
        await updateUser(editingUserId, body);
        setEditingUserId(null);
        snackbar.success("Usuario actualizado");
      } else {
        await createUser({
          usuario: userForm.usuario,
          nombreCompleto: userForm.nombreCompleto,
          contrasena: userForm.contrasena,
          rol: userForm.rol,
          estado: userForm.estado,
        });
        snackbar.success("Usuario creado");
      }
      setUserForm(emptyUserForm());
      setUserModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar el usuario");
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!deleteUserTarget) return;
    setDeleteUserLoading(true);
    try {
      await removeUser(deleteUserTarget.id);
      setDeleteUserTarget(null);
      snackbar.success("Usuario eliminado");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteUserLoading(false);
  };

  const openCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm());
    setTemplateModalOpen(true);
  };

  const openEditTemplate = (t) => {
    setEditingTemplateId(t.id);
    setTemplateForm({
      nombre: t.nombre ?? "",
      mensaje: t.mensaje ?? "",
      activa: t.activa !== false,
      predeterminada: t.predeterminada === true,
    });
    setTemplateModalOpen(true);
  };

  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { nombre: templateForm.nombre.trim(), mensaje: templateForm.mensaje.trim(), activa: templateForm.activa, predeterminada: templateForm.predeterminada };
      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, body);
        setEditingTemplateId(null);
        snackbar.success("Plantilla actualizada");
      } else {
        await createTemplate(body);
        snackbar.success("Plantilla creada");
      }
      setTemplateForm(emptyTemplateForm());
      setTemplateModalOpen(false);
    } catch (err) {
      snackbar.error(err?.message || "Error al guardar la plantilla");
    }
  };

  const handleDeleteTemplateConfirm = async () => {
    if (!deleteTemplateTarget) return;
    setDeleteTemplateLoading(true);
    try {
      await removeTemplate(deleteTemplateTarget.id);
      setDeleteTemplateTarget(null);
      snackbar.success("Plantilla eliminada");
    } catch (err) {
      snackbar.error(err?.message || "Error al eliminar");
    }
    setDeleteTemplateLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4 text-red-700 dark:text-red-200">
        {error}
      </div>
    );
  }

  const updatedDate = settings.updatedAt
    ? new Date(settings.updatedAt).toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configuración</h1>
            <p className="text-slate-600 dark:text-slate-300">Datos del negocio, apariencia y usuarios</p>
          </div>
        </div>
      </div>

      {/* Primera fila: Usuario actual + General (tipo cambio, apariencia, sonido) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usuario actual */}
        <Card className="p-6">
          <SectionTitle icon={User} title="Usuario actual" />
          <div className="flex items-center gap-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 text-xl font-semibold">
              {(user?.nombreCompleto || user?.usuario || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.nombreCompleto ?? user?.usuario ?? "—"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user?.usuario ?? "—"}</p>
              <p className="mt-0.5 text-xs font-medium text-primary-600">{user?.rol ?? "—"}</p>
            </div>
          </div>
        </Card>

        {/* General: tipo de cambio, apariencia, volumen */}
        <Card className="p-6">
          <SectionTitle icon={DollarSign} title="General" />
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Tipo de cambio (C$ = 1 USD)</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Se usa para convertir ventas y pagos en dólares a córdobas en totales y reportes.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">C$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 36.8"
                  value={exchangeRateLocal}
                  onChange={(e) => setExchangeRateLocal(e.target.value)}
                  className="w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
                  aria-label="Tipo de cambio córdobas por dólar"
                />
                <span className="text-slate-500 dark:text-slate-400 text-sm">= $1 USD</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveExchangeRate}
                  disabled={savingExchangeRate}
                >
                  {savingExchangeRate ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Apariencia</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateKey("theme", "light")}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all",
                    settings.theme === "light"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Sun className="h-4 w-4" />
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => updateKey("theme", "dark")}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all",
                    settings.theme === "dark"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Moon className="h-4 w-4" />
                  Oscuro
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Datos de la óptica */}
      <Card className="p-6">
        <SectionTitle icon={Building2} title="Datos de la óptica" />
        {updatedDate && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Última actualización: {updatedDate} · {user?.usuario ?? "—"}
          </p>
        )}
        <form onSubmit={handleSubmitAgency} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre de la óptica"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              placeholder={`Ej: ${APP_NAME}`}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              >
                <option value="NIO">Córdobas (NIO)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Correo electrónico"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contacto@agencia.com"
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="505 8123 4567"
            />
          </div>
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Ciudad, dirección (para facturas o recibos)"
          />
          <div className="pt-2">
            <Button type="submit" size="lg">
              Guardar datos de la óptica
            </Button>
          </div>
        </form>
      </Card>

      {/* Gestión de Usuarios */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <SectionTitle icon={Users} title="Usuarios del sistema" className="mb-0" />
          <Button onClick={openCreateUser}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar usuario
          </Button>
        </div>
        {usersLoading ? (
          <div className="py-6">
            <TableSkeleton columns={5} rows={4} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            message="No hay usuarios registrados"
            description="Agrega el primer usuario del sistema."
            action={
              <Button onClick={openCreateUser}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar usuario
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Usuario</TableHeaderCell>
                  <TableHeaderCell>Nombre completo</TableHeaderCell>
                  <TableHeaderCell>Rol</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell className="w-24">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-100">{u.usuario}</TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-200">{u.nombreCompleto}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300">{u.rol}</TableCell>
                    <TableCell>
                      <span className={cn("font-medium", u.estado === "Activo" ? "text-emerald-600" : "text-slate-500 dark:text-slate-400")}>
                        {u.estado}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUserTarget({ id: u.id, name: u.usuario })}
                          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Plantillas de Mensajes WhatsApp (solo Administrador) */}
      {user?.rol === "Administrador" && (
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <SectionTitle icon={MessageCircle} title="Plantillas de Mensajes WhatsApp" className="mb-0" />
            <Button onClick={openCreateTemplate}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva plantilla
            </Button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Variables disponibles: {WHATSAPP_VARS}
          </p>
          {templatesLoading ? (
            <div className="py-6">
              <TableSkeleton columns={5} rows={4} />
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              message="No hay plantillas"
              description="Crea una plantilla para enviar facturas por WhatsApp con mensaje personalizado."
              action={
                <Button onClick={openCreateTemplate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva plantilla
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Nombre</TableHeaderCell>
                    <TableHeaderCell>Mensaje</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell>Predeterminada</TableHeaderCell>
                    <TableHeaderCell className="w-24">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-100">{t.nombre}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-slate-600 dark:text-slate-300" title={t.mensaje}>{t.mensaje || "—"}</TableCell>
                      <TableCell>
                        <span className={cn("font-medium", t.activa !== false ? "text-emerald-600" : "text-slate-500 dark:text-slate-400")}>
                          {t.activa !== false ? "Activa" : "Inactiva"}
                        </span>
                      </TableCell>
                      <TableCell>{t.predeterminada ? "✓ Predeterminada" : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTemplate(t)}
                            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary-600"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTemplateTarget({ id: t.id, name: t.nombre })}
                            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-300"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Modal usuario */}
      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title={editingUserId ? "Editar usuario" : "Agregar usuario"} size="md">
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <Input
            label="Usuario (login)"
            value={userForm.usuario}
            onChange={(e) => setUserForm((f) => ({ ...f, usuario: e.target.value }))}
            required
            disabled={!!editingUserId}
          />
          <Input
            label="Nombre completo"
            value={userForm.nombreCompleto}
            onChange={(e) => setUserForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
            required
          />
          <Input
            label={editingUserId ? "Nueva contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
            type="password"
            value={userForm.contrasena}
            onChange={(e) => setUserForm((f) => ({ ...f, contrasena: e.target.value }))}
            required={!editingUserId}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Rol</label>
              <select
                value={userForm.rol}
                onChange={(e) => setUserForm((f) => ({ ...f, rol: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              >
                <option value="Administrador">Administrador</option>
                <option value="Usuario">Usuario</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Estado</label>
              <select
                value={userForm.estado}
                onChange={(e) => setUserForm((f) => ({ ...f, estado: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingUserId ? "Guardar cambios" : "Agregar usuario"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal plantilla WhatsApp */}
      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editingTemplateId ? "Editar plantilla" : "Nueva plantilla"} size="2xl">
        <form onSubmit={handleTemplateSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={templateForm.nombre}
            onChange={(e) => setTemplateForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: Por Defecto"
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Mensaje</label>
            <textarea
              value={templateForm.mensaje}
              onChange={(e) => setTemplateForm((f) => ({ ...f, mensaje: e.target.value }))}
              placeholder="Escribe el mensaje. Puedes usar: NombreCliente, NumeroFactura, Monto, EnlacePDF..."
              required
              rows={6}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-400/20"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Variables: {WHATSAPP_VARS}</p>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={templateForm.activa}
                onChange={(e) => setTemplateForm((f) => ({ ...f, activa: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Activa</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={templateForm.predeterminada}
                onChange={(e) => setTemplateForm((f) => ({ ...f, predeterminada: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Predeterminada (solo una)</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingTemplateId ? "Guardar cambios" : "Crear plantilla"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTemplateTarget}
        onClose={() => setDeleteTemplateTarget(null)}
        onConfirm={handleDeleteTemplateConfirm}
        title="Eliminar plantilla"
        message={
          deleteTemplateTarget
            ? `¿Eliminar la plantilla "${deleteTemplateTarget.name}"?`
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteTemplateLoading}
      />

      <ConfirmModal
        open={!!deleteUserTarget}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={handleDeleteUserConfirm}
        title="Eliminar usuario"
        message={
          deleteUserTarget
            ? `¿Eliminar al usuario "${deleteUserTarget.name}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteUserLoading}
      />
    </div>
  );
}
