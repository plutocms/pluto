import { plutoCsvCell, plutoFormsCsv } from '../shared/utils/forms-csv'
import {
  definePlutoForm,
  definePlutoFormField,
  PLUTO_FORM_DEFAULT_SUCCESS,
  PLUTO_FORM_HANDLE,
  plutoFormCustomTypes,
  plutoFormRecipients,
  plutoFormSettings,
  plutoMergeForm,
  plutoPublicForm,
} from '../shared/utils/forms-define'
import { plutoFormFields } from '../shared/utils/forms-fields'
import {
  PLUTO_FORM_MAX_BODY_BYTES,
  plutoValidateForm,
} from '../shared/utils/forms-validate'

Object.assign(globalThis, {
  definePlutoForm,
  definePlutoFormField,
  PLUTO_FORM_DEFAULT_SUCCESS,
  PLUTO_FORM_HANDLE,
  PLUTO_FORM_MAX_BODY_BYTES,
  plutoCsvCell,
  plutoFormCustomTypes,
  plutoFormFields,
  plutoFormRecipients,
  plutoFormSettings,
  plutoFormsCsv,
  plutoMergeForm,
  plutoPublicForm,
  plutoValidateForm,
})
