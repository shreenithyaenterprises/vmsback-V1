// companyConfig.controller.js
import { getDatabaseByTarget } from '../config/database.js';

export const createCompanyConfig = async (req, res) => {
  try {
    const { company_name, company_logo, address, contact_email, contact_phone } = req.body;
    const pool = await getDatabaseByTarget('main');
    await pool.request()
      .input('company_name', company_name)
      .input('company_logo', company_logo)
      .input('address', address)
      .input('contact_email', contact_email)
      .input('contact_phone', contact_phone)
      .execute('sp_create_company_config');
    res.status(201).json({ message: 'Company config created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCompanyConfigs = async (req, res) => {
  try {
    const pool = await getDatabaseByTarget('main');
    const result = await pool.request().execute('sp_get_company_configs');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCompanyConfigById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getDatabaseByTarget('main');
    const result = await pool.request()
      .input('id', id)
      .execute('sp_get_company_config_by_id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateCompanyConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, company_logo, address, contact_email, contact_phone } = req.body;
    const pool = await getDatabaseByTarget('main');
    await pool.request()
      .input('id', id)
      .input('company_name', company_name)
      .input('company_logo', company_logo)
      .input('address', address)
      .input('contact_email', contact_email)
      .input('contact_phone', contact_phone)
      .execute('sp_update_company_config');
    res.json({ message: 'Company config updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteCompanyConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getDatabaseByTarget('main');
    await pool.request()
      .input('id', id)
      .execute('sp_delete_company_config');
    res.json({ message: 'Company config deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
