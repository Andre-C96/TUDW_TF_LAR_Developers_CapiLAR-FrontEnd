import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { getProfessionalServicesRequest } from '../../api/professionals';
import { formatDuration } from '../../api/services';
import type { Servicio } from '../../api/services';
import { deactivateMeRequest, updateProfileRequest } from '../../api/users';
import type { UpdateProfileData } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { Form, FormField } from '../../components/form/form';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

// Mismo criterio que el registro
const PHONE_REGEX = /^\+?[\d\s()-]{8,20}$/;
const ALERGIA_MAX = 255;

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

const formatMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

// Caja blanca de cada bloque del perfil
const sectionClasses = 'flex flex-col gap-6 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md md:p-8';

// Dato que no se puede editar desde el perfil
const ReadOnlyField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{label}</span>
    <span className="rounded-lg bg-gray-50 px-4 py-3 font-inter text-sm text-black">{children}</span>
  </div>
);

// Perfil del usuario logueado (CLIENTE en /mi-perfil, PROFESIONAL en /panel/perfil): nombre, apellido y correo fijos;
// teléfono editable; alergias editables solo para CLIENTE; legajo y servicios fijos solo para PROFESIONAL
// (los servicios los asigna el ADMIN desde Usuarios).
// La foto de perfil queda para cuando el back la guarde: por ahora, las iniciales.
export const Profile = () => {
  const { user, token, updateUser, logout } = useAuth();
  const isCliente = user?.rol === 'CLIENTE';

  const initialTelefono = user?.telefono ?? '';
  const initialAlergia = user?.cliente?.alergia ?? '';
  const [telefono, setTelefono] = useState(initialTelefono);
  const [alergia, setAlergia] = useState(initialAlergia);
  const [errors, setErrors] = useState<{ telefono?: string; alergia?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Servicios asignados al profesional (null mientras cargan). Se mira el rol porque el back no borra el subtipo:
  // alguien que fue profesional y ahora es cliente conserva su legajo
  const legajo = user?.rol === 'PROFESIONAL' ? user.profesional?.legajo : undefined;
  const [services, setServices] = useState<Servicio[] | null>(null);
  const [servicesError, setServicesError] = useState('');

  useEffect(() => {
    if (!token || legajo === undefined) return;
    let ignore = false;
    getProfessionalServicesRequest(token, legajo)
      .then((data) => {
        if (!ignore) setServices(data);
      })
      .catch((err) => {
        if (!ignore) setServicesError(err instanceof ApiError ? err.message : unexpectedError);
      });
    return () => {
      ignore = true;
    };
  }, [token, legajo]);

  // ProtectedRoute ya garantiza la sesión
  if (!user || !token) return null;

  const hasChanges = telefono.trim() !== initialTelefono || (isCliente && alergia.trim() !== initialAlergia);

  const validate = () => {
    const next: typeof errors = {};
    if (!telefono.trim()) next.telefono = 'Ingresá tu teléfono';
    else if (!PHONE_REGEX.test(telefono.trim())) next.telefono = 'Ingresá un teléfono válido';
    if (alergia.trim().length > ALERGIA_MAX) next.alergia = `Hasta ${ALERGIA_MAX} caracteres`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError('');
    if (!validate()) return;

    // Solo los campos que cambiaron; alergia vacía la borra
    const data: UpdateProfileData = {};
    if (telefono.trim() !== initialTelefono) data.telefono = telefono.trim();
    if (isCliente && alergia.trim() !== initialAlergia) data.alergia = alergia.trim() || null;

    setIsSaving(true);
    try {
      const updated = await updateProfileRequest(token, data);
      updateUser(updated);
      setTelefono(updated.telefono ?? '');
      setAlergia(updated.cliente?.alergia ?? '');
      toast.success('Perfil actualizado', { description: 'Tus datos se guardaron correctamente.' });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteOpen(false);
    setDeleteError('');
  };

  // Baja lógica: el token deja de servir, así que se cierra la sesión (ProtectedRoute vuelve a la home)
  const confirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deactivateMeRequest(token);
      logout();
      toast('Tu cuenta fue dada de baja', { description: 'Gracias por haber sido parte de capiLAR.' });
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : unexpectedError);
      setIsDeleting(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={
            isCliente
              ? [{ label: 'Inicio', to: '/' }, { label: 'Mi perfil' }]
              : [{ label: 'Panel', to: '/panel' }, { label: 'Perfil' }]
          }
        />
        <Title>Mi perfil</Title>
      </div>

      {/* Encabezado: iniciales (después, la foto), nombre y antigüedad */}
      <div className={`${sectionClasses} items-center text-center md:flex-row md:text-left`}>
        <span
          aria-hidden="true"
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-capilar-gradient font-inter text-3xl font-semibold text-white shadow-md"
        >
          {user.nombre[0]}
          {user.apellido[0]}
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-inter text-2xl font-semibold text-black">
            {user.nombre} {user.apellido}
          </p>
          <p className="font-inter text-sm text-capilar-grey">
            {isCliente ? 'Cliente' : 'Profesional'} desde {formatMonthYear(user.fechaAlta)}
          </p>
        </div>
      </div>

      <Form onSubmit={handleSubmit} noValidate className={sectionClasses}>
        <div className="flex flex-col gap-1">
          <Title as="h2" className="text-xl! md:text-2xl!">
            Datos personales
          </Title>
          <p className="font-inter text-sm text-capilar-grey">
            Mantené tu teléfono al día para que podamos avisarte de tus turnos.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <ReadOnlyField label="Nombre">{user.nombre}</ReadOnlyField>
          <ReadOnlyField label="Apellido">{user.apellido}</ReadOnlyField>
          <ReadOnlyField label="Correo electrónico">{user.email}</ReadOnlyField>
          {legajo !== undefined && <ReadOnlyField label="Legajo">{legajo}</ReadOnlyField>}
          <FormField
            label="Teléfono"
            type="tel"
            autoComplete="tel"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            error={errors.telefono}
          />
        </div>

        {isCliente && (
          <FormField
            label="Alergias"
            value={alergia}
            onChange={(event) => setAlergia(event.target.value)}
            maxLength={ALERGIA_MAX}
            placeholder="Ej.: amoníaco, tinturas con PPD"
            hint={
              initialAlergia
                ? 'Si ya no tenés alergias, dejá el campo vacío.'
                : 'Opcional. Nos ayuda a cuidarte en cada servicio.'
            }
            error={errors.alergia}
          />
        )}

        {saveError && (
          <Alert variant="error" title="No se pudieron guardar los cambios">
            {saveError}
          </Alert>
        )}

        <Button
          type="submit"
          disabled={!hasChanges || isSaving}
          className="self-end px-8 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </Form>

      {/* Servicios del profesional: solo lectura, los asigna el ADMIN */}
      {legajo !== undefined && (
        <div className={sectionClasses}>
          <div className="flex flex-col gap-1">
            <Title as="h2" className="text-xl! md:text-2xl!">
              Mis servicios
            </Title>
            <p className="font-inter text-sm text-capilar-grey">
              Los servicios que podés realizar. Los asigna la administración del salón.
            </p>
          </div>

          {servicesError ? (
            <Alert variant="error" title="No se pudieron cargar tus servicios">
              {servicesError}
            </Alert>
          ) : !services ? (
            <Loader label="Cargando servicios..." className="py-4" />
          ) : services.length === 0 ? (
            <p className="font-inter text-sm text-capilar-grey">
              Todavía no tenés servicios asignados. Pedíselos a la administración.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {services.map((servicio) => (
                <li
                  key={servicio.id}
                  className="rounded-full border border-capilar-violet/20 bg-capilar-violet/10 px-4 py-1.5 font-inter text-sm text-black"
                >
                  {servicio.tipo}
                  <span className="text-capilar-grey"> · {formatDuration(servicio.tiempoDuracion)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Baja de la cuenta: al final y con confirmación */}
      <div className={`${sectionClasses} md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-col gap-1">
          <p className="font-inter font-semibold text-black">Dar de baja mi cuenta</p>
          <p className="font-inter text-sm text-capilar-grey">No vas a poder volver a iniciar sesión con esta cuenta.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsDeleteOpen(true)}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-red-500 hover:text-red-500"
        >
          Dar de baja
        </button>
      </div>

      <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal} ariaLabel="Dar de baja mi cuenta">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <Title as="h2">Dar de baja mi cuenta</Title>
            <p className="font-inter text-sm text-capilar-grey">
              ¿Seguro que querés darte de baja? Se va a cerrar tu sesión y no vas a poder volver a ingresar.
            </p>
          </div>

          {deleteError && (
            <p role="alert" className="text-center font-inter text-sm text-red-500">
              {deleteError}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="grey" onClick={closeDeleteModal} disabled={isDeleting} className="flex-1 py-3 uppercase">
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex-1 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Procesando...' : 'Dar de baja'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};
