import { getDatabaseByTarget } from '../../../config/database.js';

/**
 * Get all active PPE items
 */
export const getPPEList = async (req, res) => {
    try {
        const pool = await getDatabaseByTarget('main');
        const result = await pool.request()
            .execute('PPE_Master_GetAll_SP');

        if (!result.recordset || result.recordset.length === 0) {
            return res.json({
                success: false,
                message: 'No PPE items found'
            });
        }

        const jsonData = result.recordset[0]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B'];
        const ppeItems = JSON.parse(jsonData);

        res.json({
            success: true,
            message: 'PPE items fetched successfully',
            data: ppeItems
        });
    } catch (error) {
        console.error('Error fetching PPE items:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching PPE items',
            error: error.message
        });
    }
};
