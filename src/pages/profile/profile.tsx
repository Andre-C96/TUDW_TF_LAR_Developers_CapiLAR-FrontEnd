import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { addMyServiceRequest, getMyServicesRequest, removeMyServiceRequest } from '../../api/professionals';
import { formatDuration, getServicesRequest } from '../../api/services';
import type { Servicio } from '../../api/services';
import {
  ALERGIA_MAX,
  FECHA_NACIMIENTO_MIN,
  FOTO_TIPOS,
  TELEFONO_HINT,
  TELEFONO_MAX,
  deactivateMeRequest,
  fechaNacimientoMax,
  formatEdad,
  onlyDigits,
  removePhotoRequest,
  resendVerificationRequest,
  updatePhotoRequest,
  updateProfileRequest,
  userPhoto,
  validateFechaNacimiento,
  validateFoto,
  validateTelefono,
} from '../../api/users';
import type { UpdateProfileData } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Avatar } from '../../components/avatar/avatar';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ChangePasswordForm } from '../../components/changePasswordForm/changePasswordForm';
import { Form, FormField } from '../../components/form/form';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { ProfessionalServicesForm } from '../../components/professionalServicesForm/professionalServicesForm';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

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

// Lápiz del botón de editar, con el color del texto
const PencilIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

// Cámara del botón de la foto, con el color del texto
const CameraIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

// Perfil del usuario logueado (CLIENTE en /mi-perfil, PROFESIONAL en /panel/perfil): nombre, apellido y correo fijos;
// teléfono y fecha de nacimiento (con la edad) editables; alergias editables solo para CLIENTE; legajo fijo y servicios editables solo para PROFESIONAL
// (los elige del catálogo del salón).
// Foto de perfil con la cámara sobre el círculo (sin foto, las iniciales). Cambio de contraseña y baja de la cuenta al final.
export const Profile = () => {
  const { user, token, updateUser, changePassword, logout } = useAuth();
  const isCliente = user?.rol === 'CLIENTE';

  const initialTelefono = user?.telefono ?? '';
  const initialAlergia = user?.cliente?.alergia ?? '';
  const initialFechaNacimiento = user?.fechaNacimiento ?? '';
  const [telefono, setTelefono] = useState(initialTelefono);
  const [alergia, setAlergia] = useState(initialAlergia);
  const [fechaNacimiento, setFechaNacimiento] = useState(initialFechaNacimiento);
  const [errors, setErrors] = useState<{ telefono?: string; alergia?: string; fechaNacimiento?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [isResending, setIsResending] = useState(false);

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Foto de perfil: el input de archivo está oculto y lo abre el botón de la cámara
  const photoInput = useRef<HTMLInputElement>(null);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);

  // Servicios del profesional (null mientras cargan). Se mira el rol porque el back no borra el subtipo:
  // alguien que fue profesional y ahora es cliente conserva su legajo
  const legajo = user?.rol === 'PROFESIONAL' ? user.profesional?.legajo : undefined;
  const [services, setServices] = useState<Servicio[] | null>(null);
  const [servicesError, setServicesError] = useState('');

  // Modal para elegir servicios: catálogo del salón (null mientras carga)
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [catalog, setCatalog] = useState<Servicio[] | null>(null);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [servicesSaveError, setServicesSaveError] = useState('');

  useEffect(() => {
    if (!token || legajo === undefined) return;
    let ignore = false;
    getMyServicesRequest(token)
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

  const telefonoChanged = telefono !== initialTelefono;
  const fechaChanged = fechaNacimiento !== initialFechaNacimiento;
  const hasChanges = telefonoChanged || fechaChanged || (isCliente && alergia.trim() !== initialAlergia);

  const validate = () => {
    const next: typeof errors = {};
    // Solo si lo cambió: los teléfonos cargados antes pueden tener espacios o guiones y no traban el resto
    const telefonoError = telefonoChanged ? validateTelefono(telefono) : undefined;
    if (telefonoError) next.telefono = telefonoError;
    const fechaError = validateFechaNacimiento(fechaNacimiento);
    if (fechaError) next.fechaNacimiento = fechaError;
    if (alergia.trim().length > ALERGIA_MAX) next.alergia = `Hasta ${ALERGIA_MAX} caracteres`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError('');
    if (!validate()) return;

    // Solo los campos que cambiaron; alergia o fecha vacías se borran
    const data: UpdateProfileData = {};
    if (telefonoChanged) data.telefono = telefono;
    if (fechaChanged) data.fechaNacimiento = fechaNacimiento || null;
    if (isCliente && alergia.trim() !== initialAlergia) data.alergia = alergia.trim() || null;

    setIsSaving(true);
    try {
      const updated = await updateProfileRequest(token, data);
      updateUser(updated);
      setTelefono(updated.telefono ?? '');
      setAlergia(updated.cliente?.alergia ?? '');
      setFechaNacimiento(updated.fechaNacimiento ?? '');
      toast.success('Perfil actualizado', { description: 'Tus datos se guardaron correctamente.' });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const foto = userPhoto(user);

  // Sube o reemplaza la foto apenas se elige el archivo
  const changePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Para poder volver a elegir el mismo archivo
    event.target.value = '';
    if (!file) return;
    const error = validateFoto(file);
    if (error) {
      toast.error('No se pudo cambiar la foto', { description: error });
      return;
    }

    setIsPhotoSaving(true);
    try {
      updateUser(await updatePhotoRequest(token, file));
      toast.success(foto ? 'Foto actualizada' : 'Foto cargada');
    } catch (err) {
      toast.error('No se pudo cambiar la foto', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setIsPhotoSaving(false);
    }
  };

  const removePhoto = async () => {
    setIsPhotoSaving(true);
    try {
      updateUser(await removePhotoRequest(token));
      toast('Foto quitada', { description: 'Se van a ver tus iniciales.' });
    } catch (err) {
      toast.error('No se pudo quitar la foto', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setIsPhotoSaving(false);
    }
  };

  // Abre el modal de servicios y pide el catálogo (puede haber servicios nuevos desde la última vez)
  const openServices = async () => {
    setIsServicesOpen(true);
    setCatalog(null);
    setServicesSaveError('');
    try {
      setCatalog(await getServicesRequest());
    } catch (err) {
      setServicesSaveError(err instanceof ApiError ? err.message : unexpectedError);
    }
  };

  const closeServices = () => {
    if (isSavingServices) return;
    setIsServicesOpen(false);
  };

  // Manda solo las diferencias: suma los tildados nuevos y quita los destildados
  const saveServices = async (selectedIds: number[]) => {
    if (!services) return;
    const currentIds = services.map((servicio) => servicio.id);
    const toAdd = selectedIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !selectedIds.includes(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      setIsServicesOpen(false);
      return;
    }

    setIsSavingServices(true);
    setServicesSaveError('');
    const results = await Promise.allSettled([
      ...toAdd.map((id) => addMyServiceRequest(token, id)),
      ...toRemove.map((id) => removeMyServiceRequest(token, id)),
    ]);
    const failed = results.find((result) => result.status === 'rejected');

    // Haya fallado o no, la lista muestra lo que quedó guardado de verdad
    try {
      setServices(await getMyServicesRequest(token));
    } catch {
      // Se queda con la lista anterior
    }
    setIsSavingServices(false);

    if (failed) {
      setServicesSaveError(failed.reason instanceof ApiError ? failed.reason.message : unexpectedError);
      return;
    }
    setIsServicesOpen(false);
    toast.success('Servicios actualizados', { description: 'Los clientes ya pueden reservarlos con vos.' });
  };

  const resendVerification = async () => {
    setIsResending(true);
    try {
      const { message } = await resendVerificationRequest(token);
      toast.success('Enlace enviado', { description: `${message}. Vence en 7 días.` });
    } catch (err) {
      toast.error('No se pudo enviar el enlace', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setIsResending(false);
    }
  };

  const closePasswordModal = () => {
    if (isChangingPassword) return;
    setIsPasswordOpen(false);
    setPasswordError('');
  };

  // El contexto guarda la sesión nueva que devuelve el back (las de otros dispositivos se cierran)
  const submitPassword = async (actual: string, nueva: string) => {
    setIsChangingPassword(true);
    setPasswordError('');
    try {
      await changePassword(actual, nueva);
      setIsPasswordOpen(false);
      toast.success('Contraseña actualizada', { description: 'Cerramos la sesión en tus otros dispositivos.' });
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsChangingPassword(false);
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

      {/* Encabezado: foto (o iniciales) con la cámara para cambiarla, nombre, antigüedad y edad */}
      <div className={`${sectionClasses} items-center text-center md:flex-row md:text-left`}>
        <div className="relative shrink-0">
          <Avatar
            token={token}
            userId={user.id}
            nombre={user.nombre}
            apellido={user.apellido}
            foto={foto}
            className={`h-24 w-24 text-3xl transition-opacity ${isPhotoSaving ? 'opacity-60' : ''}`}
          />
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            disabled={isPhotoSaving}
            aria-label={foto ? 'Cambiar foto' : 'Subir foto'}
            title={foto ? 'Cambiar foto' : 'Subir foto'}
            className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-capilar-grey shadow-md transition-colors hover:border-capilar-violet hover:text-capilar-violet disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CameraIcon />
          </button>
          <input ref={photoInput} type="file" accept={FOTO_TIPOS.join(',')} onChange={changePhoto} className="hidden" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-inter text-2xl font-semibold text-black">
            {user.nombre} {user.apellido}
          </p>
          <p className="font-inter text-sm text-capilar-grey">
            {isCliente ? 'Cliente' : 'Profesional'} desde {formatMonthYear(user.fechaAlta)}
            {user.fechaNacimiento && ` · ${formatEdad(user.fechaNacimiento)}`}
          </p>
          {foto ? (
            <button
              type="button"
              onClick={removePhoto}
              disabled={isPhotoSaving}
              className="mt-1 self-center font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:text-red-500 disabled:opacity-50 md:self-start"
            >
              Quitar foto
            </button>
          ) : (
            <p className="mt-1 font-inter text-xs text-capilar-grey">Tocá la cámara para subir una foto (JPG, PNG o WEBP, hasta 2 MB).</p>
          )}
        </div>
      </div>

      {/* Sin verificar el correo, el cliente no puede reservar solo */}
      {isCliente && !user.emailVerificadoEn && (
        <Alert variant="advertencia" title="Verificá tu correo para reservar turnos">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span>
              Te mandamos un enlace a <span className="font-semibold">{user.email}</span>. Si no lo encontrás (revisá el spam)
              o venció, pedí uno nuevo.
            </span>
            <button
              type="button"
              onClick={resendVerification}
              disabled={isResending}
              className="shrink-0 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
            >
              {isResending ? 'Enviando...' : 'Reenviar enlace'}
            </button>
          </div>
        </Alert>
      )}

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
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={TELEFONO_MAX}
            value={telefono}
            // Solo deja escribir números
            onChange={(event) => setTelefono(onlyDigits(event.target.value))}
            hint={TELEFONO_HINT}
            error={errors.telefono}
          />
          <FormField
            label="Fecha de nacimiento"
            type="date"
            autoComplete="bday"
            min={FECHA_NACIMIENTO_MIN}
            max={fechaNacimientoMax()}
            value={fechaNacimiento}
            onChange={(event) => setFechaNacimiento(event.target.value)}
            hint={
              fechaNacimiento && !validateFechaNacimiento(fechaNacimiento)
                ? `Tenés ${formatEdad(fechaNacimiento)}.`
                : 'Opcional.'
            }
            error={errors.fechaNacimiento}
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
          className="self-end px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </Form>

      {/* Servicios del profesional: los elige del catálogo del salón */}
      {legajo !== undefined && (
        <div className={sectionClasses}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <Title as="h2" className="text-xl! md:text-2xl!">
                Mis servicios
              </Title>
              <p className="font-inter text-sm text-capilar-grey">
                Los servicios que hacés. Los clientes solo pueden reservarlos con vos si los tenés acá.
              </p>
            </div>
            {services && (
              <Button
                variant="secundario"
                onClick={openServices}
                aria-label="Editar mis servicios"
                title="Editar"
                // Botón chico, solo con el ícono (el de adentro trae px-6 py-2)
                className="shrink-0 self-start [&>button]:p-2"
              >
                <PencilIcon />
              </Button>
            )}
          </div>

          {servicesError ? (
            <Alert variant="error" title="No se pudieron cargar tus servicios">
              {servicesError}
            </Alert>
          ) : !services ? (
            <Loader label="Cargando servicios..." className="py-4" />
          ) : services.length === 0 ? (
            <p className="font-inter text-sm text-capilar-grey">
              Todavía no elegiste servicios. Tocá el lápiz para sumar los que hacés.
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

      {/* Cambio de contraseña con la sesión iniciada */}
      <div className={`${sectionClasses} md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-col gap-1">
          <p className="font-inter font-semibold text-black">Contraseña</p>
          <p className="font-inter text-sm text-capilar-grey">Cambiala cuando quieras. Vas a necesitar la actual.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPasswordOpen(true)}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet"
        >
          Cambiar contraseña
        </button>
      </div>

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

      <Modal isOpen={isServicesOpen} onClose={closeServices} ariaLabel="Mis servicios">
        {catalog && services ? (
          <ProfessionalServicesForm
            // Si cambian los guardados (ej. después de un error), el formulario arranca de nuevo con lo guardado
            key={services.map((servicio) => servicio.id).join(',')}
            services={catalog}
            assignedIds={services.map((servicio) => servicio.id)}
            onSubmit={saveServices}
            onCancel={closeServices}
            isLoading={isSavingServices}
            error={servicesSaveError}
          />
        ) : servicesSaveError ? (
          <div className="flex flex-col gap-6">
            <Alert variant="error" title="No se pudo cargar el catálogo">
              {servicesSaveError}
            </Alert>
            <Button variant="grey" onClick={closeServices} className="py-2 text-sm uppercase">
              Cerrar
            </Button>
          </div>
        ) : (
          <Loader label="Cargando servicios..." className="py-8" />
        )}
      </Modal>

      <Modal isOpen={isPasswordOpen} onClose={closePasswordModal} ariaLabel="Cambiar contraseña">
        <ChangePasswordForm
          onSubmit={submitPassword}
          onCancel={closePasswordModal}
          isLoading={isChangingPassword}
          error={passwordError}
        />
      </Modal>

      <Modal isOpen={isDeleteOpen}onClose={closeDeleteModal} ariaLabel="Dar de baja mi cuenta">
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
            <Button variant="grey" onClick={closeDeleteModal} disabled={isDeleting} className="flex-1 py-2 text-sm uppercase">
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Procesando...' : 'Dar de baja'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};
